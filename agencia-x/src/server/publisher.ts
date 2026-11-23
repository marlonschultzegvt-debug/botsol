/**
 * Publicador automático do Instagram. Roda a cada poucos minutos (/api/cron/publish)
 * e também quando alguém toca em "Publicar agora".
 *
 * Regras de segurança:
 *  - Só publica conteúdo com status APROVADO, com data/hora já passada.
 *  - Só se o cliente tiver Instagram conectado e a publicação automática ligada.
 *  - Precisa ter mídia anexada (vídeo para Reels, JPEG para post/carrossel).
 *
 * Em cada rodada:
 *  1. Renova tokens que vencem em menos de 7 dias.
 *  2. Confere contêineres em processamento → publica os prontos.
 *  3. Cria contêineres para os conteúdos aprovados que chegaram na hora.
 */
import "server-only";
import type { Asset, ContentPiece, InstagramAccount } from "@prisma/client";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import {
  containerStatus, createContainer, InstagramError, mediaPermalink, publishContainer, refreshToken, igConfigured,
} from "@/lib/instagram";
import { publicTempUrl } from "@/lib/storage";

const MAX_ATTEMPTS = 3;
const PROCESSING_TIMEOUT_MS = 30 * 60_000; // vídeo parado há 30 min → falha

type PieceWithStuff = ContentPiece & { assets: Asset[]; client: { name: string; igAccount: InstagramAccount | null } };
export type PublishReport = { refreshed: number; published: string[]; processing: string[]; failed: string[]; skipped: string[] };

const isJpeg = (a: Asset) => /^image\/jpe?g$/i.test(a.mimeType);
const isVideo = (a: Asset) => a.mimeType.startsWith("video/");

function captionOf(p: ContentPiece) {
  const tags = p.hashtags.length ? `\n\n${p.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}` : "";
  return `${p.caption ?? ""}${tags}`.trim().slice(0, 2200); // limite do Instagram
}

async function fail(p: ContentPiece, message: string) {
  await db.contentPiece.update({
    where: { id: p.id },
    data: { publishStatus: "FAILED", publishError: message.slice(0, 500), igContainerId: null },
  });
}

/** Cria o(s) contêiner(es) na Meta conforme o formato do conteúdo. */
async function createContainers(p: PieceWithStuff, acc: InstagramAccount, token: string): Promise<string> {
  const assets = [...p.assets].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (!assets.length) throw new InstagramError("Anexe a mídia (vídeo ou imagem JPG) no conteúdo antes de publicar.");
  const url = async (a: Asset) => {
    const u = await publicTempUrl(a.storageKey);
    if (!u) throw new InstagramError("Publicação exige o Supabase Storage configurado (a mídia precisa de link público).");
    return u;
  };
  const caption = captionOf(p);

  switch (p.format) {
    case "REELS":
    case "SHORTS": {
      const v = assets.find(isVideo);
      if (!v) throw new InstagramError("Reels precisa de um vídeo anexado (MP4/MOV).");
      return createContainer(acc.igUserId, token, { media_type: "REELS", video_url: await url(v), caption });
    }
    case "STORIES": {
      const m = assets.find((a) => isVideo(a) || isJpeg(a));
      if (!m) throw new InstagramError("Stories precisa de um vídeo ou imagem JPG anexado.");
      return createContainer(acc.igUserId, token, isVideo(m)
        ? { media_type: "STORIES", video_url: await url(m) }
        : { media_type: "STORIES", image_url: await url(m) });
    }
    case "CAROUSEL": {
      const items = assets.filter((a) => isJpeg(a) || isVideo(a)).slice(0, 20);
      if (items.length < 2) throw new InstagramError("Carrossel precisa de pelo menos 2 imagens JPG (ou vídeos) anexados.");
      if (items.some(isVideo)) throw new InstagramError("Por enquanto o carrossel aceita só imagens JPG. Remova os vídeos ou publique como Reels.");
      const children: string[] = [];
      for (const it of items) children.push(await createContainer(acc.igUserId, token, { image_url: await url(it), is_carousel_item: true }));
      return createContainer(acc.igUserId, token, { media_type: "CAROUSEL", children: children.join(","), caption });
    }
    default: {
      // STATIC
      const img = assets.find(isJpeg);
      if (!img) throw new InstagramError(assets.some((a) => a.mimeType.startsWith("image/"))
        ? "O Instagram só aceita imagem em JPG. Converta a imagem (PNG/WEBP → JPG) e anexe de novo."
        : "Post precisa de uma imagem JPG anexada.");
      return createContainer(acc.igUserId, token, { image_url: await url(img), caption });
    }
  }
}

/** Confere um contêiner em processamento; publica se estiver pronto. */
async function advance(p: PieceWithStuff, acc: InstagramAccount, token: string, report: PublishReport) {
  const st = await containerStatus(p.igContainerId!, token);
  if (st.status_code === "FINISHED") {
    const mediaId = await publishContainer(acc.igUserId, token, p.igContainerId!);
    const link = await mediaPermalink(mediaId, token);
    await db.contentPiece.update({
      where: { id: p.id },
      data: {
        publishStatus: "PUBLISHED", status: "PUBLISHED", igMediaId: mediaId, publishedUrl: link,
        publishedAt: new Date(), publishError: null, igContainerId: null,
      },
    });
    report.published.push(p.title);
  } else if (st.status_code === "PUBLISHED") {
    await db.contentPiece.update({ where: { id: p.id }, data: { publishStatus: "PUBLISHED", status: "PUBLISHED", publishedAt: new Date(), igContainerId: null } });
    report.published.push(p.title);
  } else if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
    await fail(p, `A Meta não conseguiu processar a mídia (${st.status ?? st.status_code}). Confira formato, duração e tamanho do vídeo.`);
    report.failed.push(p.title);
  } else if (Date.now() - p.updatedAt.getTime() > PROCESSING_TIMEOUT_MS) {
    await fail(p, "O processamento do vídeo passou de 30 minutos. Tente publicar de novo.");
    report.failed.push(p.title);
  } else {
    report.processing.push(p.title);
  }
}

async function tokenFor(acc: InstagramAccount) {
  return decrypt(acc.accessTokenEnc);
}

/** Renova tokens que vencem em até 7 dias (e têm mais de 24h). */
async function refreshExpiring(report: PublishReport) {
  const soon = new Date(Date.now() + 7 * 864e5);
  const accs = await db.instagramAccount.findMany({ where: { tokenExpiresAt: { lt: soon, gt: new Date() } } });
  for (const acc of accs) {
    if (Date.now() - acc.updatedAt.getTime() < 864e5) continue;
    try {
      const r = await refreshToken(await tokenFor(acc));
      await db.instagramAccount.update({ where: { id: acc.id }, data: { accessTokenEnc: encrypt(r.token), tokenExpiresAt: r.expiresAt, lastError: null } });
      report.refreshed++;
    } catch (e) {
      await db.instagramAccount.update({ where: { id: acc.id }, data: { lastError: `Renovação do acesso falhou: ${(e as Error).message}` } });
    }
  }
}

const include = { assets: true, client: { select: { name: true, igAccount: true } } } as const;

/**
 * Uma rodada do publicador. `onlyPieceId` processa só um conteúdo (botão "Publicar agora"),
 * ignorando a data agendada mas ainda exigindo aprovação.
 */
export async function runPublisher(opts: { onlyPieceId?: string; agencyId?: string } = {}): Promise<PublishReport> {
  const report: PublishReport = { refreshed: 0, published: [], processing: [], failed: [], skipped: [] };
  if (!igConfigured()) return report;
  if (!opts.onlyPieceId) await refreshExpiring(report);

  const scope = { ...(opts.onlyPieceId ? { id: opts.onlyPieceId } : {}), ...(opts.agencyId ? { agencyId: opts.agencyId } : {}) };

  // 1) Contêineres em processamento
  const processing = (await db.contentPiece.findMany({
    where: { ...scope, publishStatus: "PROCESSING", igContainerId: { not: null } },
    include,
    take: 25,
  })) as PieceWithStuff[];
  for (const p of processing) {
    const acc = p.client.igAccount;
    if (!acc) { await fail(p, "O Instagram do cliente foi desconectado."); report.failed.push(p.title); continue; }
    try { await advance(p, acc, await tokenFor(acc), report); }
    catch (e) { await handleError(p, e, report); }
  }

  // 2) Novos: aprovados, na hora, com Instagram conectado e publicação ligada
  const due = (await db.contentPiece.findMany({
    where: {
      ...scope,
      status: "APPROVED",
      platform: "INSTAGRAM",
      publishStatus: { in: opts.onlyPieceId ? ["NONE", "FAILED"] : ["NONE"] },
      ...(opts.onlyPieceId ? {} : { scheduledAt: { lte: new Date() } }),
      client: { igAccount: opts.onlyPieceId ? { isNot: null } : { is: { autoPublish: true } } },
    },
    include,
    orderBy: { scheduledAt: "asc" },
    take: 10,
  })) as PieceWithStuff[];

  for (const p of due) {
    const acc = p.client.igAccount!;
    try {
      const token = await tokenFor(acc);
      const containerId = await createContainers(p, acc, token);
      const fresh = await db.contentPiece.update({
        where: { id: p.id },
        data: { publishStatus: "PROCESSING", igContainerId: containerId, publishError: null, publishAttempts: { increment: 1 } },
        include,
      });
      // Imagem costuma ficar pronta na hora: tenta publicar já.
      await advance(fresh as PieceWithStuff, acc, token, report);
    } catch (e) {
      await handleError(p, e, report);
    }
  }
  return report;
}

async function handleError(p: PieceWithStuff, e: unknown, report: PublishReport) {
  const err = e as InstagramError;
  console.error("[publisher]", p.id, err.message);
  // Erro passageiro da Meta: tenta de novo na próxima rodada (até MAX_ATTEMPTS).
  if (err.transient && p.publishAttempts + 1 < MAX_ATTEMPTS) {
    await db.contentPiece.update({ where: { id: p.id }, data: { publishAttempts: { increment: 1 }, publishError: `Tentando de novo: ${err.message}` } });
    report.skipped.push(p.title);
    return;
  }
  await fail(p, err.message || "Erro desconhecido ao publicar.");
  report.failed.push(p.title);
}
