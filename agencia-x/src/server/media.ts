/**
 * Mídia gerada: carrossel (pronto), e os pontos de extensão para imagem por IA e Reels.
 * Toda geração vira um registro em AiGeneration com os arquivos (assetIds) e o custo (costUsd).
 * Nada aqui publica: publicar exige aprovação humana (ver scheduleMediaAction).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateJson } from "@/lib/ai/claude";
import { claudeCostUsd } from "@/lib/ai/pricing";
import { BASE_STRATEGIST } from "@/lib/ai/prompts/base";
import { FONT_FILES, renderCarousel, type Brand, type CarouselStyle, type FontKey, type MediaFormat, type Slide } from "@/lib/media/carousel";
import { getObjectBytes, putObject } from "@/lib/storage";
import type { SessionUser } from "@/lib/session";

export const SlideSchema = z.object({
  titulo: z.string().trim().min(2).max(140),
  texto: z.string().trim().max(360).optional().default(""),
  visual: z.string().trim().max(300).optional(),
});
export const SlidesSchema = z.array(SlideSchema).min(2, "Mínimo 2 slides").max(10, "Máximo 10 slides");

const DEFAULT_BRAND = { primary: "#0B1220", accent: "#19D3F0", bg: "#F6F4EF", text: "#FFFFFF", font: "montserrat" as FontKey };

/** Identidade visual do cliente (com padrões quando não cadastrada) + logo embutida. */
export async function getBrand(agencyId: string, clientId: string): Promise<Brand & { clientName: string }> {
  const c = await db.client.findFirst({ where: { id: clientId, agencyId } });
  if (!c) throw new Error("Cliente não encontrado.");
  let logoDataUri: string | null = null;
  if (c.logoAssetId) {
    const logo = await db.asset.findFirst({ where: { id: c.logoAssetId, clientId } });
    if (logo) {
      try {
        const png = await sharp(await getObjectBytes(logo.storageKey)).resize({ height: 144, withoutEnlargement: true }).png().toBuffer();
        logoDataUri = `data:image/png;base64,${png.toString("base64")}`;
      } catch (e) {
        console.error("[brand] logo", e);
      }
    }
  }
  const font = (c.brandFont && c.brandFont in FONT_FILES ? c.brandFont : DEFAULT_BRAND.font) as FontKey;
  return {
    clientName: c.name,
    name: c.name,
    handle: c.instagram ?? null,
    primary: c.brandPrimary ?? DEFAULT_BRAND.primary,
    accent: c.brandAccent ?? DEFAULT_BRAND.accent,
    bg: c.brandBg ?? DEFAULT_BRAND.bg,
    text: c.brandText ?? DEFAULT_BRAND.text,
    font,
    logoDataUri,
  };
}

export type MediaResult = {
  generationId: string;
  kind: "carousel";
  clientId: string;
  clientName: string;
  caption: string;
  assets: { id: string; fileName: string }[];
  costUsd: number;
  format: MediaFormat;
};

/** Desenha o carrossel, guarda os JPEGs no cliente e registra a geração com custo. */
export async function createCarousel(opts: {
  user: SessionUser;
  clientId: string;
  slides: Slide[];
  style?: CarouselStyle;
  format?: MediaFormat;
  caption?: string;
  extraCostUsd?: number; // ex.: tokens do Claude que escreveu os slides
  source?: string;
}): Promise<MediaResult> {
  const slides = SlidesSchema.parse(opts.slides);
  const style = opts.style ?? "impacto";
  const format = opts.format ?? "feed";
  const brand = await getBrand(opts.user.agencyId, opts.clientId);
  const jpegs = await renderCarousel(slides, brand, style, format);

  const batch = randomUUID().slice(0, 8);
  const assets: { id: string; fileName: string }[] = [];
  for (const [i, jpg] of jpegs.entries()) {
    const fileName = `carrossel-${batch}-${String(i + 1).padStart(2, "0")}.jpg`;
    const key = `${opts.user.agencyId}/${opts.clientId}/gerados/${fileName}`;
    await putObject(key, jpg, "image/jpeg");
    const a = await db.asset.create({
      data: { clientId: opts.clientId, uploadedById: opts.user.id, fileName, mimeType: "image/jpeg", sizeBytes: jpg.length, storageKey: key, kind: "generated" },
    });
    assets.push({ id: a.id, fileName });
  }

  const cost = +(opts.extraCostUsd ?? 0).toFixed(4); // renderização local: custo zero
  const gen = await db.aiGeneration.create({
    data: {
      agencyId: opts.user.agencyId, userId: opts.user.id, clientId: opts.clientId, type: "CAROUSEL_ART",
      input: { slides, style, format, source: opts.source ?? "manual" },
      output: opts.caption ?? "", model: "render-local", provider: "next/og", costUsd: cost,
      assetIds: assets.map((a) => a.id),
    },
  });
  return { generationId: gen.id, kind: "carousel", clientId: opts.clientId, clientName: brand.clientName, caption: opts.caption ?? "", assets, costUsd: cost, format };
}

const SLIDES_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["slides", "legenda"],
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "texto", "visual"],
        properties: {
          titulo: { type: "string", description: "Até 8 palavras. Slide 1 = gancho." },
          texto: { type: "string", description: "Até 30 palavras. Vazio na capa se não precisar." },
          visual: { type: "string", description: "Sugestão visual curta" },
        },
      },
    },
    legenda: { type: "string", description: "Legenda do post com CTA e 5-10 hashtags no final" },
  },
} as const;

/** Claude transforma um tema ou um texto de carrossel em slides estruturados. */
export async function slidesFromSource(opts: { agencyId: string; clientId?: string; topic?: string; text?: string; count?: number }) {
  const client = opts.clientId ? await db.client.findFirst({ where: { id: opts.clientId, agencyId: opts.agencyId } }) : null;
  const n = Math.min(Math.max(opts.count ?? 7, 3), 10);
  const prompt = [
    `Monte um carrossel de Instagram com exatamente ${n} slides.`,
    client && `Cliente: ${client.name} (${client.niche}). Tom de voz: ${client.brandVoice ?? "adequado ao nicho"}. Público: ${client.targetAudience ?? "-"}.`,
    opts.topic && `Tema: ${opts.topic}`,
    opts.text && `Use este conteúdo como base (reaproveite os títulos e textos, ajustando para caber):\n${opts.text.slice(0, 6000)}`,
    "Regras: slide 1 é a capa com gancho forte; um assunto por slide; textos curtos para caber na arte; último slide com CTA.",
  ].filter(Boolean).join("\n");

  const r = await generateJson<{ slides: Slide[]; legenda: string }>({
    system: `${BASE_STRATEGIST}\n\nVocê escreve carrosséis para Instagram: textos curtos, escaneáveis e fortes.`,
    prompt,
    schema: SLIDES_JSON_SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
  });
  return { slides: r.data.slides, caption: r.data.legenda, costUsd: claudeCostUsd(r.model, r.inputTokens, r.outputTokens) };
}

/** Resolve o cliente pelo nome (o Jarvis fala em nomes, não em IDs). */
export async function findClientByName(agencyId: string, name: string) {
  const all = await db.client.findMany({ where: { agencyId, status: { not: "CHURN" } }, select: { id: true, name: true } });
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const q = norm(name);
  return all.find((c) => norm(c.name) === q) ?? all.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name))) ?? null;
}
