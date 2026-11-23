"use server";
/** Ações do Calendário Editorial (ContentPiece). */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ContentFormat, ContentStatus, Platform } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, requireUser } from "@/lib/session";

export type ContentActionResult = { error?: string; id?: string };

const ContentSchema = z.object({
  title: z.string().trim().min(2, "Dê um título"),
  clientId: z.string().min(1, "Escolha o cliente"),
  format: z.nativeEnum(ContentFormat),
  platform: z.nativeEnum(Platform),
  status: z.nativeEnum(ContentStatus),
  scheduledAt: z.string().min(10, "Escolha a data"), // "2026-11-23T18:00"
  script: z.string().optional().transform((v) => v?.trim() || null),
  caption: z.string().optional().transform((v) => v?.trim() || null),
});
export type ContentInput = z.input<typeof ContentSchema>;

async function ownClient(agencyId: string, clientId: string) {
  return db.client.findFirst({ where: { id: clientId, agencyId }, select: { id: true } });
}

const refresh = () => {
  revalidatePath("/calendario");
  revalidatePath("/dashboard");
};

export async function saveContentAction(id: string | null, input: ContentInput): Promise<ContentActionResult> {
  const user = await requireUser();
  assertCan(user, "content:write");
  const parsed = ContentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { scheduledAt, ...rest } = parsed.data;
  if (!(await ownClient(user.agencyId, rest.clientId))) return { error: "Cliente inválido." };

  const data = { ...rest, scheduledAt: new Date(scheduledAt) };
  if (id) {
    const res = await db.contentPiece.updateMany({ where: { id, agencyId: user.agencyId }, data });
    if (!res.count) return { error: "Conteúdo não encontrado." };
    refresh();
    return { id };
  }
  const created = await db.contentPiece.create({ data: { ...data, agencyId: user.agencyId, hashtags: [] } });
  refresh();
  return { id: created.id };
}

/** Arrastar e soltar: muda só o dia, mantendo o horário. */
export async function moveContentAction(id: string, isoDay: string) {
  const user = await requireUser();
  assertCan(user, "content:write");
  const piece = await db.contentPiece.findFirst({ where: { id, agencyId: user.agencyId } });
  if (!piece) return;
  const [y, m, d] = isoDay.split("-").map(Number);
  const next = new Date(piece.scheduledAt ?? new Date());
  next.setFullYear(y, m - 1, d);
  await db.contentPiece.update({ where: { id }, data: { scheduledAt: next } });
  refresh();
}

export async function deleteContentAction(id: string) {
  const user = await requireUser();
  assertCan(user, "content:write");
  await db.contentPiece.deleteMany({ where: { id, agencyId: user.agencyId } });
  refresh();
}

/** Do Estúdio: transforma uma geração da IA em item do calendário. */
export async function saveGenerationToCalendarAction(input: {
  generationId?: string;
  clientId: string;
  title: string;
  format: ContentFormat;
  date: string;
  text: string;
}): Promise<ContentActionResult> {
  const user = await requireUser();
  assertCan(user, "content:write");
  if (!input.clientId) return { error: "Escolha o cliente." };
  if (!(await ownClient(user.agencyId, input.clientId))) return { error: "Cliente inválido." };
  const gen = input.generationId
    ? await db.aiGeneration.findFirst({ where: { id: input.generationId, agencyId: user.agencyId }, select: { id: true } })
    : null;
  const isCaption = input.format === "STATIC";
  const created = await db.contentPiece.create({
    data: {
      agencyId: user.agencyId, clientId: input.clientId, title: input.title.slice(0, 120) || "Conteúdo gerado",
      format: input.format, status: "SCRIPTED", scheduledAt: new Date(`${input.date}T18:00:00`),
      script: isCaption ? null : input.text, caption: isCaption ? input.text : null, hashtags: [],
      aiGenerationId: gen?.id,
    },
  });
  refresh();
  return { id: created.id };
}
