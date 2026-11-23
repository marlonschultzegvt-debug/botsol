"use server";
/**
 * Ações da etapa 3: serviços, contratos, entregas, faturamento em lote,
 * tarefas, aprovações do portal e acesso do cliente ao portal.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ApprovalDecision, CampaignStatus, DeliverableStatus, Priority, TaskStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan, requireUser } from "@/lib/session";

export type OpResult = { error?: string; ok?: boolean; info?: string };

const fail = (e: z.ZodError): OpResult => ({ error: e.issues[0]?.message ?? "Dados inválidos" });
const moneyNum = z.coerce.number({ message: "Valor inválido" }).min(0, "Valor inválido");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const atNoon = (d: string) => new Date(`${d}T12:00:00`);

async function ownClient(agencyId: string, clientId: string) {
  return db.client.findFirst({ where: { id: clientId, agencyId }, select: { id: true } });
}

// ───────────────────────────────── Serviços ──────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().trim().min(2, "Nome do serviço muito curto"),
  description: z.string().trim().optional().transform((v) => v || null),
  price: moneyNum,
  billingCycle: z.enum(["MONTHLY", "ONE_TIME"]),
  deliverables: z.array(z.object({ tipo: z.string().trim().min(1), qtd: z.coerce.number().int().min(1).max(999) })).max(20),
});
export type ServiceInput = z.input<typeof ServiceSchema>;

export async function saveServiceAction(id: string | null, input: ServiceInput): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "clients:write");
  const p = ServiceSchema.safeParse(input);
  if (!p.success) return fail(p.error);
  if (id) {
    const r = await db.service.updateMany({ where: { id, agencyId: user.agencyId }, data: p.data });
    if (!r.count) return { error: "Serviço não encontrado." };
  } else {
    await db.service.create({ data: { ...p.data, agencyId: user.agencyId } });
  }
  revalidatePath("/campanhas");
  return { ok: true };
}

export async function toggleServiceAction(id: string, active: boolean) {
  const user = await requireUser();
  assertCan(user, "clients:write");
  await db.service.updateMany({ where: { id, agencyId: user.agencyId }, data: { active } });
  revalidatePath("/campanhas");
}

// ─────────────────────────────── Contratos ───────────────────────────────────

const ContractSchema = z.object({
  clientId: z.string().min(1, "Escolha o cliente"),
  serviceId: z.string().min(1, "Escolha o serviço"),
  name: z.string().trim().optional().transform((v) => v || null),
  status: z.nativeEnum(CampaignStatus),
  price: moneyNum,
  startDate: dateStr,
  endDate: z.string().optional().transform((v) => (v ? v : null)),
  /** Ao criar: gera as entregas a partir do pacote do serviço. */
  generateDeliverables: z.boolean().optional(),
});
export type ContractInput = z.input<typeof ContractSchema>;

export async function saveContractAction(id: string | null, input: ContractInput): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "clients:write");
  const p = ContractSchema.safeParse(input);
  if (!p.success) return fail(p.error);
  const { generateDeliverables, startDate, endDate, ...rest } = p.data;

  if (!(await ownClient(user.agencyId, rest.clientId))) return { error: "Cliente inválido." };
  const service = await db.service.findFirst({ where: { id: rest.serviceId, agencyId: user.agencyId } });
  if (!service) return { error: "Serviço inválido." };

  const data = { ...rest, startDate: atNoon(startDate), endDate: endDate ? atNoon(endDate) : null };

  if (id) {
    const own = await db.clientService.findFirst({ where: { id, client: { agencyId: user.agencyId } }, select: { id: true } });
    if (!own) return { error: "Contrato não encontrado." };
    await db.clientService.update({ where: { id }, data });
  } else {
    // Entregas do pacote distribuídas ao longo de 4 semanas a partir do início.
    const pack = (Array.isArray(service.deliverables) ? service.deliverables : []) as { tipo: string; qtd: number }[];
    const items = generateDeliverables ? pack.flatMap((d) => Array.from({ length: d.qtd }, (_, i) => `${d.tipo} ${i + 1}/${d.qtd}`)) : [];
    const start = atNoon(startDate);
    await db.clientService.create({
      data: {
        ...data,
        deliverables: {
          create: items.map((title, i) => ({
            title,
            dueDate: new Date(start.getTime() + Math.round(((i + 1) / items.length) * 28) * 864e5),
          })),
        },
      },
    });
  }
  revalidatePath("/campanhas");
  revalidatePath(`/clientes/${rest.clientId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteContractAction(id: string): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "clients:write");
  const r = await db.clientService.deleteMany({ where: { id, client: { agencyId: user.agencyId } } });
  revalidatePath("/campanhas");
  revalidatePath("/dashboard");
  return r.count ? { ok: true } : { error: "Contrato não encontrado." };
}

// ─────────────────────────────── Entregas ────────────────────────────────────

export async function addDeliverableAction(contractId: string, title: string, dueDate: string): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "content:write");
  const p = z.object({ title: z.string().trim().min(2, "Descreva a entrega"), dueDate: dateStr }).safeParse({ title, dueDate });
  if (!p.success) return fail(p.error);
  const own = await db.clientService.findFirst({ where: { id: contractId, client: { agencyId: user.agencyId } }, select: { id: true } });
  if (!own) return { error: "Contrato não encontrado." };
  await db.deliverable.create({ data: { clientServiceId: contractId, title: p.data.title, dueDate: atNoon(p.data.dueDate) } });
  revalidatePath("/campanhas");
  return { ok: true };
}

export async function setDeliverableStatusAction(id: string, status: DeliverableStatus): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "content:write");
  const d = await db.deliverable.findFirst({ where: { id, clientService: { client: { agencyId: user.agencyId } } } });
  if (!d) return { error: "Entrega não encontrada." };
  await db.deliverable.update({ where: { id }, data: { status, deliveredAt: status === "DELIVERED" ? new Date() : null } });
  revalidatePath("/campanhas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteDeliverableAction(id: string) {
  const user = await requireUser();
  assertCan(user, "clients:write");
  await db.deliverable.deleteMany({ where: { id, clientService: { client: { agencyId: user.agencyId } } } });
  revalidatePath("/campanhas");
}

// ─────────────────────────────── Financeiro ──────────────────────────────────

/** Cria a mensalidade do mês para cada cliente ativo que ainda não tem fatura no mês. */
export async function generateMonthlyInvoicesAction(): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "finance:write");
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const clients = await db.client.findMany({
    where: { agencyId: user.agencyId, status: "ACTIVE", monthlyFee: { gt: 0 }, invoices: { none: { dueDate: { gte: start, lt: end } } } },
    select: { id: true, monthlyFee: true },
  });
  const due = new Date(now.getFullYear(), now.getMonth(), 10, 12);
  const ref = `Mensalidade ${due.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}`;
  await db.invoice.createMany({
    data: clients.map((c) => ({
      agencyId: user.agencyId, clientId: c.id, amount: c.monthlyFee!, dueDate: due, reference: ref,
      status: due < new Date(now.toDateString()) ? "OVERDUE" : "PENDING",
    })),
  });
  revalidatePath("/campanhas");
  revalidatePath("/dashboard");
  return { ok: true, info: clients.length ? `${clients.length} fatura(s) criada(s).` : "Todos os clientes ativos já têm fatura neste mês." };
}

/** Marca como atrasadas as faturas pendentes com vencimento passado. */
export async function refreshOverdueAction(): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "finance:write");
  const r = await db.invoice.updateMany({
    where: { agencyId: user.agencyId, status: "PENDING", dueDate: { lt: new Date(new Date().toDateString()) } },
    data: { status: "OVERDUE" },
  });
  revalidatePath("/campanhas");
  revalidatePath("/dashboard");
  return { ok: true, info: `${r.count} fatura(s) marcada(s) como atrasada(s).` };
}

// ─────────────────────────────── Tarefas ─────────────────────────────────────

const TaskSchema = z.object({
  title: z.string().trim().min(2, "Dê um título à tarefa"),
  description: z.string().trim().optional().transform((v) => v || null),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(Priority),
  dueDate: z.string().optional().transform((v) => (v ? atNoon(v) : null)),
  assigneeId: z.string().optional().transform((v) => v || null),
  clientId: z.string().optional().transform((v) => v || null),
});
export type TaskInput = z.input<typeof TaskSchema>;

export async function saveTaskAction(id: string | null, input: TaskInput): Promise<OpResult> {
  const user = await requireUser();
  if (user.role === "CLIENT") return { error: "Sem permissão." };
  const p = TaskSchema.safeParse(input);
  if (!p.success) return fail(p.error);
  const data = p.data;
  if (data.clientId && !(await ownClient(user.agencyId, data.clientId))) return { error: "Cliente inválido." };
  if (data.assigneeId) {
    const m = await db.membership.findFirst({ where: { agencyId: user.agencyId, userId: data.assigneeId, role: { not: "CLIENT" } } });
    if (!m) return { error: "Responsável inválido." };
  }
  if (id) {
    const r = await db.task.updateMany({ where: { id, agencyId: user.agencyId }, data });
    if (!r.count) return { error: "Tarefa não encontrada." };
  } else {
    await db.task.create({ data: { ...data, agencyId: user.agencyId } });
  }
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function moveTaskAction(id: string, status: TaskStatus) {
  const user = await requireUser();
  if (user.role === "CLIENT") return;
  await db.task.updateMany({ where: { id, agencyId: user.agencyId }, data: { status } });
  revalidatePath("/tarefas");
}

export async function deleteTaskAction(id: string) {
  const user = await requireUser();
  if (user.role === "CLIENT") return;
  await db.task.deleteMany({ where: { id, agencyId: user.agencyId } });
  revalidatePath("/tarefas");
}

// ─────────────────────────────── Portal ──────────────────────────────────────

/**
 * Cliente aprova ou pede ajustes. Só o próprio cliente (papel CLIENT) decide;
 * a equipe vê o portal em modo prévia, somente leitura.
 * Aprovado → APPROVED. Ajuste → volta para EDITED com o comentário.
 */
export async function decideContentAction(contentId: string, decision: ApprovalDecision, comment: string): Promise<OpResult> {
  const user = await requireUser();
  if (user.role !== "CLIENT" || !user.clientId) return { error: "Apenas o cliente pode aprovar pelo portal." };
  if (decision === "PENDING") return { error: "Decisão inválida." };
  const text = comment.trim();
  if (decision === "CHANGES_REQUESTED" && text.length < 3) return { error: "Explique o que precisa mudar." };

  const piece = await db.contentPiece.findFirst({
    where: { id: contentId, clientId: user.clientId, agencyId: user.agencyId, status: "IN_APPROVAL" },
  });
  if (!piece) return { error: "Conteúdo não está mais aguardando aprovação." };

  await db.$transaction([
    db.approval.create({ data: { contentPieceId: contentId, reviewerId: user.id, decision, comment: text || null } }),
    db.contentPiece.update({ where: { id: contentId }, data: { status: decision === "APPROVED" ? "APPROVED" : "EDITED" } }),
  ]);
  revalidatePath("/portal");
  revalidatePath("/calendario");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Cria (ou recria a senha de) o acesso do cliente ao portal. Devolve a senha temporária uma vez. */
export async function createPortalAccessAction(clientId: string, name: string, email: string): Promise<OpResult & { password?: string }> {
  const user = await requireUser();
  assertCan(user, "clients:write");
  const p = z
    .object({ name: z.string().trim().min(2, "Informe o nome"), email: z.string().trim().toLowerCase().email("E-mail inválido") })
    .safeParse({ name, email });
  if (!p.success) return fail(p.error);
  if (!(await ownClient(user.agencyId, clientId))) return { error: "Cliente inválido." };

  const password = randomBytes(6).toString("base64url"); // ~8 caracteres
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.user.findUnique({ where: { email: p.data.email }, include: { memberships: true } });

  if (existing) {
    const m = existing.memberships.find((x) => x.agencyId === user.agencyId);
    const orphan = existing.memberships.length === 0; // conta sem nenhuma agência (ex.: cliente removido)
    // Por segurança só reaproveita contas deste mesmo cliente ou contas órfãs.
    if (!orphan && (!m || m.role !== "CLIENT" || m.clientId !== clientId))
      return { error: "Este e-mail já é usado por outra conta. Use outro e-mail." };
    await db.user.update({
      where: { id: existing.id },
      data: {
        passwordHash, name: p.data.name,
        ...(orphan && { memberships: { create: { agencyId: user.agencyId, role: "CLIENT", clientId } } }),
      },
    });
  } else {
    await db.user.create({
      data: {
        name: p.data.name, email: p.data.email, passwordHash,
        memberships: { create: { agencyId: user.agencyId, role: "CLIENT", clientId } },
      },
    });
  }
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, password };
}

export async function revokePortalAccessAction(clientId: string, userId: string): Promise<OpResult> {
  const user = await requireUser();
  assertCan(user, "clients:write");
  await db.membership.deleteMany({ where: { agencyId: user.agencyId, userId, clientId, role: "CLIENT" } });
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}
