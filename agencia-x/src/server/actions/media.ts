"use server";
/**
 * Aprovação humana da mídia gerada: só aqui um carrossel/imagem vira conteúdo do calendário.
 *  - "cliente":   vai para o calendário como "Aprovação" (cliente aprova no portal).
 *  - "aprovado":  vai como "Aprovado" e o publicador posta no horário (se o Instagram estiver conectado).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertCan, requireUser } from "@/lib/session";

const Input = z.object({
  generationId: z.string().min(1),
  title: z.string().trim().min(2, "Dê um título").max(120),
  caption: z.string().max(2200).optional().default(""),
  scheduledAt: z.string().min(10, "Escolha data e hora"),
  mode: z.enum(["cliente", "aprovado", "rascunho"]),
});
export type ScheduleMediaInput = z.input<typeof Input>;

export async function scheduleMediaAction(input: ScheduleMediaInput): Promise<{ ok?: boolean; error?: string; contentId?: string }> {
  const user = await requireUser();
  assertCan(user, "content:write");
  const p = Input.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const { generationId, title, caption, scheduledAt, mode } = p.data;

  const gen = await db.aiGeneration.findFirst({ where: { id: generationId, agencyId: user.agencyId } });
  if (!gen || !gen.clientId || !gen.assetIds.length) return { error: "Mídia não encontrada." };
  // Sem fuso explícito ("2026-11-25T18:00"), vale o horário de Brasília (sem horário de verão desde 2019).
  const when = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(scheduledAt) ? scheduledAt : `${scheduledAt.slice(0, 16)}:00-03:00`);
  if (Number.isNaN(when.getTime())) return { error: "Data inválida." };
  if (mode === "aprovado" && when.getTime() < Date.now() - 60_000) return { error: "Escolha um horário no futuro." };

  // Hashtags no fim da legenda viram o campo de hashtags (o publicador junta de volta).
  const tags = Array.from(caption.matchAll(/#([\p{L}\p{N}_]+)/gu)).map((m) => m[1]);
  const body = caption.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim();
  const format = gen.type === "CAROUSEL_ART" ? (gen.assetIds.length > 1 ? "CAROUSEL" : "STATIC") : gen.type === "REEL" ? "REELS" : "STATIC";

  const piece = await db.contentPiece.create({
    data: {
      agencyId: user.agencyId, clientId: gen.clientId, title, format, platform: "INSTAGRAM",
      status: mode === "aprovado" ? "APPROVED" : mode === "cliente" ? "IN_APPROVAL" : "EDITED",
      caption: body || null, hashtags: tags, scheduledAt: when, aiGenerationId: gen.id,
    },
  });
  await db.asset.updateMany({ where: { id: { in: gen.assetIds }, client: { agencyId: user.agencyId } }, data: { contentPieceId: piece.id } });

  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  revalidatePath("/conteudo");
  return { ok: true, contentId: piece.id };
}
