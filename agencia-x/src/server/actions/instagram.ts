"use server";
/** Ações do Instagram: pausar/retomar, desconectar e "Publicar agora". */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { assertCan, requireUser } from "@/lib/session";
import { runPublisher } from "@/server/publisher";

export async function setAutoPublishAction(clientId: string, on: boolean) {
  const user = await requireUser();
  assertCan(user, "clients:write");
  await db.instagramAccount.updateMany({ where: { clientId, agencyId: user.agencyId }, data: { autoPublish: on } });
  revalidatePath(`/clientes/${clientId}`);
}

export async function disconnectInstagramAction(clientId: string) {
  const user = await requireUser();
  assertCan(user, "clients:write");
  await db.instagramAccount.deleteMany({ where: { clientId, agencyId: user.agencyId } });
  revalidatePath(`/clientes/${clientId}`);
}

/** Publica um conteúdo aprovado agora (ignora a data agendada). */
export async function publishNowAction(contentId: string): Promise<{ ok?: boolean; error?: string; info?: string }> {
  const user = await requireUser();
  assertCan(user, "content:write");
  const piece = await db.contentPiece.findFirst({
    where: { id: contentId, agencyId: user.agencyId },
    include: { client: { select: { igAccount: { select: { id: true } } } } },
  });
  if (!piece) return { error: "Conteúdo não encontrado." };
  if (piece.status !== "APPROVED") return { error: "Só conteúdo Aprovado pode ser publicado. Mude o status para Aprovado." };
  if (!piece.client.igAccount) return { error: "O cliente ainda não tem Instagram conectado (ficha do cliente → Instagram)." };
  if (piece.publishStatus === "PUBLISHED") return { error: "Este conteúdo já foi publicado." };
  if (piece.publishStatus === "PROCESSING") return { info: "Já está sendo processado pela Meta. Aguarde alguns minutos." };

  const r = await runPublisher({ onlyPieceId: contentId, agencyId: user.agencyId });
  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  if (r.published.length) return { ok: true, info: "Publicado no Instagram! 🎉" };
  if (r.processing.length) return { ok: true, info: "Mídia enviada. A Meta está processando o vídeo; publica sozinho em alguns minutos." };
  const after = await db.contentPiece.findUnique({ where: { id: contentId }, select: { publishError: true } });
  return { error: after?.publishError ?? "Não foi possível publicar." };
}
