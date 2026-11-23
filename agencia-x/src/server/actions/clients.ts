"use server";
/**
 * Ações de Clientes: criar, editar, mudar status, notas e faturas.
 * Toda ação: (1) pega usuário da sessão, (2) checa permissão,
 * (3) valida com zod, (4) filtra por agencyId, (5) revalida a tela.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ClientStatus, InvoiceStatus, NoteType } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, requireUser } from "@/lib/session";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const money = z
  .string()
  .trim()
  .transform((v) => (v ? Number(v.replace(/\./g, "").replace(",", ".")) : null))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Valor inválido");
const opt = z.string().trim().transform((v) => v || null);

const ClientSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto"),
  niche: z.string().trim().min(2, "Informe o nicho"),
  instagram: opt.transform((v) => (v && !v.startsWith("@") ? `@${v}` : v)),
  tiktok: opt,
  website: opt,
  goals: opt,
  brandVoice: opt,
  targetAudience: opt,
  avgTicket: money,
  monthlyFee: money,
  status: z.nativeEnum(ClientStatus),
});

const formToObj = (f: FormData) =>
  Object.fromEntries(["name", "niche", "instagram", "tiktok", "website", "goals", "brandVoice", "targetAudience", "avgTicket", "monthlyFee", "status"].map((k) => [k, String(f.get(k) ?? "")]));

export async function createClientAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  assertCan(user, "clients:write");
  const parsed = ClientSchema.safeParse(formToObj(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const c = await db.client.create({ data: { ...parsed.data, agencyId: user.agencyId } });
  revalidatePath("/clientes");
  redirect(`/clientes/${c.id}`);
}

export async function updateClientAction(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  assertCan(user, "clients:write");
  const parsed = ClientSchema.safeParse(formToObj(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const prev = await db.client.findFirst({ where: { id, agencyId: user.agencyId }, select: { status: true } });
  if (!prev) return { error: "Cliente não encontrado." };
  await db.client.update({
    where: { id },
    data: {
      ...parsed.data,
      // registra a data de churn quando o status muda para CHURN
      churnedAt: parsed.data.status === "CHURN" && prev.status !== "CHURN" ? new Date() : parsed.data.status !== "CHURN" ? null : undefined,
    },
  });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  return { ok: true };
}

export async function deleteClientAction(id: string) {
  const user = await requireUser();
  assertCan(user, "clients:write");
  await db.client.deleteMany({ where: { id, agencyId: user.agencyId } });
  revalidatePath("/clientes");
  redirect("/clientes");
}

const NoteSchema = z.object({ type: z.nativeEnum(NoteType), body: z.string().trim().min(2, "Escreva a nota").max(5000) });

export async function addNoteAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = NoteSchema.safeParse({ type: form.get("type"), body: form.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const client = await db.client.findFirst({ where: { id: clientId, agencyId: user.agencyId }, select: { id: true } });
  if (!client) return { error: "Cliente não encontrado." };
  await db.clientNote.create({ data: { ...parsed.data, clientId, authorId: user.id } });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function deleteNoteAction(noteId: string) {
  const user = await requireUser();
  const note = await db.clientNote.findFirst({ where: { id: noteId, client: { agencyId: user.agencyId } } });
  if (!note) return;
  if (note.authorId !== user.id && user.role !== "ADMIN") throw new Error("Só o autor ou um Admin apaga a nota.");
  await db.clientNote.delete({ where: { id: noteId } });
  revalidatePath(`/clientes/${note.clientId}`);
}

const InvoiceSchema = z.object({
  amount: money.refine((v) => v !== null && v > 0, "Informe o valor"),
  dueDate: z.string().min(8, "Informe o vencimento"),
  reference: opt,
});

export async function addInvoiceAction(clientId: string, _: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  assertCan(user, "finance:write");
  const parsed = InvoiceSchema.safeParse({ amount: String(form.get("amount") ?? ""), dueDate: form.get("dueDate"), reference: String(form.get("reference") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const client = await db.client.findFirst({ where: { id: clientId, agencyId: user.agencyId }, select: { id: true } });
  if (!client) return { error: "Cliente não encontrado." };
  const due = new Date(`${parsed.data.dueDate}T12:00:00`);
  await db.invoice.create({
    data: {
      agencyId: user.agencyId, clientId, amount: parsed.data.amount!, dueDate: due, reference: parsed.data.reference,
      status: due < new Date(new Date().toDateString()) ? "OVERDUE" : "PENDING",
    },
  });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function setInvoiceStatusAction(invoiceId: string, status: InvoiceStatus) {
  const user = await requireUser();
  assertCan(user, "finance:write");
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, agencyId: user.agencyId } });
  if (!inv) return;
  await db.invoice.update({ where: { id: invoiceId }, data: { status, paidAt: status === "PAID" ? new Date() : null } });
  revalidatePath(`/clientes/${inv.clientId}`);
  revalidatePath("/dashboard");
}
