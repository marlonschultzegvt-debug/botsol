/**
 * Consultas da etapa 3: Campanhas & Serviços, Financeiro, Tarefas e Portal do Cliente.
 * Mesma regra de sempre: tudo filtrado pelo agencyId da sessão.
 */
import "server-only";
import type { DeliverableStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d));

/** Entrega pendente com prazo vencido conta como atrasada (calculado na leitura). */
export const effectiveDeliverableStatus = (s: DeliverableStatus, due: Date): DeliverableStatus =>
  (s === "PENDING" || s === "IN_PROGRESS") && due < new Date() ? "LATE" : s;

// ─────────────────────────── Campanhas & Serviços ────────────────────────────

export async function getCampaigns(agencyId: string) {
  const [services, contracts] = await Promise.all([
    db.service.findMany({
      where: { agencyId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { contracts: { where: { status: { in: ["RUNNING", "PLANNING"] } } } } } },
    }),
    db.clientService.findMany({
      where: { client: { agencyId } },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      include: {
        client: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        deliverables: { orderBy: { dueDate: "asc" } },
      },
    }),
  ]);

  return {
    services: services.map((s) => ({
      id: s.id, name: s.name, description: s.description, price: n(s.price), billingCycle: s.billingCycle,
      active: s.active, activeContracts: s._count.contracts,
      deliverables: (Array.isArray(s.deliverables) ? s.deliverables : []) as { tipo: string; qtd: number }[],
    })),
    contracts: contracts.map((k) => {
      const deliverables = k.deliverables.map((d) => ({
        id: d.id, title: d.title, dueDate: d.dueDate.toISOString(), status: effectiveDeliverableStatus(d.status, d.dueDate),
      }));
      return {
        id: k.id, name: k.name, status: k.status, price: n(k.price),
        startDate: k.startDate.toISOString(), endDate: k.endDate?.toISOString() ?? null,
        client: k.client, service: k.service, deliverables,
        done: deliverables.filter((d) => d.status === "DELIVERED").length,
        late: deliverables.filter((d) => d.status === "LATE").length,
      };
    }),
  };
}
export type CampaignsData = Awaited<ReturnType<typeof getCampaigns>>;

// ─────────────────────────────── Financeiro ──────────────────────────────────

export async function getFinance(agencyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [open, thisMonth, activeClients] = await Promise.all([
    db.invoice.findMany({
      where: { agencyId, status: { in: ["PENDING", "OVERDUE"] } },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    db.invoice.findMany({ where: { agencyId, dueDate: { gte: monthStart, lt: nextMonth }, status: { not: "CANCELED" } } }),
    db.client.findMany({
      where: { agencyId, status: "ACTIVE", monthlyFee: { gt: 0 } },
      select: { id: true, invoices: { where: { dueDate: { gte: monthStart, lt: nextMonth } }, select: { id: true } } },
    }),
  ]);

  return {
    open: open.map((i) => ({
      id: i.id, client: i.client, amount: n(i.amount), dueDate: i.dueDate.toISOString(), reference: i.reference,
      // vencida mesmo que ainda esteja "PENDING" no banco
      status: i.status === "PENDING" && i.dueDate < new Date(now.toDateString()) ? ("OVERDUE" as const) : i.status,
    })),
    month: {
      invoiced: thisMonth.reduce((s, i) => s + n(i.amount), 0),
      received: thisMonth.filter((i) => i.status === "PAID").reduce((s, i) => s + n(i.amount), 0),
    },
    /** Clientes ativos que ainda não têm fatura neste mês. */
    missingInvoices: activeClients.filter((c) => c.invoices.length === 0).length,
  };
}

// ─────────────────────────────── Tarefas ─────────────────────────────────────

export async function getTasksBoard(agencyId: string) {
  const [tasks, members, clients] = await Promise.all([
    db.task.findMany({
      where: { agencyId },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: { assignee: { select: { id: true, name: true } }, client: { select: { id: true, name: true } } },
    }),
    db.membership.findMany({
      where: { agencyId, role: { not: "CLIENT" } },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.client.findMany({ where: { agencyId, status: { not: "CHURN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return {
    tasks: tasks.map((t) => ({
      id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority,
      dueDate: t.dueDate?.toISOString() ?? null, assignee: t.assignee, client: t.client,
    })),
    members: members.map((m) => m.user),
    clients,
  };
}
export type BoardTask = Awaited<ReturnType<typeof getTasksBoard>>["tasks"][number];

// ─────────────────────────────── Portal ──────────────────────────────────────

export async function getPortal(agencyId: string, clientId: string) {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 864e5);
  const client = await db.client.findFirst({
    where: { id: clientId, agencyId },
    include: { agency: { select: { name: true, primaryColor: true } } },
  });
  if (!client) return null;

  const [pending, upcoming, published, assets, invoices] = await Promise.all([
    db.contentPiece.findMany({
      where: { clientId, status: "IN_APPROVAL" },
      orderBy: { scheduledAt: "asc" },
      include: { approvals: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true } } } } },
    }),
    db.contentPiece.findMany({
      where: { clientId, scheduledAt: { gte: now, lte: in30 }, status: { not: "IN_APPROVAL" } },
      orderBy: { scheduledAt: "asc" },
    }),
    db.contentPiece.findMany({ where: { clientId, status: "PUBLISHED" }, orderBy: { scheduledAt: "desc" }, take: 8 }),
    db.asset.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { uploadedBy: { select: { name: true } } },
    }),
    db.invoice.findMany({ where: { clientId, status: { not: "CANCELED" } }, orderBy: { dueDate: "desc" }, take: 6 }),
  ]);

  const iso = (d: Date | null) => d?.toISOString() ?? null;
  return {
    client: { id: client.id, name: client.name, agencyName: client.agency.name },
    pending: pending.map((p) => ({
      id: p.id, title: p.title, format: p.format, platform: p.platform, scheduledAt: iso(p.scheduledAt),
      script: p.script, caption: p.caption,
      approvals: p.approvals.map((a) => ({ decision: a.decision, comment: a.comment, by: a.reviewer.name, at: a.createdAt.toISOString() })),
    })),
    upcoming: upcoming.map((p) => ({ id: p.id, title: p.title, format: p.format, status: p.status, scheduledAt: iso(p.scheduledAt) })),
    published: published.map((p) => ({ id: p.id, title: p.title, format: p.format, scheduledAt: iso(p.scheduledAt), url: p.publishedUrl })),
    assets: assets.map((a) => ({
      id: a.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes, by: a.uploadedBy.name, at: a.createdAt.toISOString(),
    })),
    invoices: invoices.map((i) => ({ id: i.id, amount: n(i.amount), dueDate: i.dueDate.toISOString(), status: i.status, reference: i.reference })),
  };
}
export type PortalData = NonNullable<Awaited<ReturnType<typeof getPortal>>>;
