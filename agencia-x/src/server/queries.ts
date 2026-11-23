/**
 * Consultas de leitura. TODAS recebem agencyId (vindo da sessão) e filtram por ele.
 * Decimal do Prisma é convertido para number antes de sair daqui
 * (componentes client não serializam Decimal).
 */
import "server-only";
import type { ClientStatus, ContentStatus, InvoiceStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const n = (d: Prisma.Decimal | null | undefined) => (d == null ? 0 : Number(d));
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  IDEA: "Ideia", SCRIPTED: "Roteiro", FILMED: "Filmado", EDITED: "Editado",
  IN_APPROVAL: "Aprovação", APPROVED: "Aprovado", PUBLISHED: "Publicado",
};

// ─────────────────────────────── Dashboard ───────────────────────────────────

export async function getDashboard(agencyId: string) {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const in7 = new Date(now.getTime() + 7 * 864e5);

  const [clients, invoices, pipeline, upcoming, overdueInvoices, contracts] = await Promise.all([
    db.client.findMany({ where: { agencyId }, orderBy: { name: "asc" }, include: { invoices: { orderBy: { dueDate: "desc" }, take: 1 } } }),
    db.invoice.findMany({ where: { agencyId, dueDate: { gte: sixMonthsAgo }, status: { not: "CANCELED" } } }),
    db.contentPiece.groupBy({ by: ["status"], where: { agencyId }, _count: true }),
    db.contentPiece.findMany({
      where: { agencyId, status: { not: "PUBLISHED" }, OR: [{ dueAt: { lte: in7 } }, { scheduledAt: { lte: in7 } }] },
      include: { client: { select: { name: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 6,
    }),
    db.invoice.findMany({ where: { agencyId, status: "OVERDUE" }, include: { client: { select: { name: true } } } }),
    db.clientService.findMany({
      where: { client: { agencyId }, status: { in: ["RUNNING", "PLANNING"] } },
      include: { client: { select: { name: true } }, deliverables: { select: { status: true } } },
    }),
  ]);

  // Receita: faturado x recebido por mês (últimos 6).
  const revenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const inMonth = invoices.filter((x) => x.dueDate.getMonth() === d.getMonth() && x.dueDate.getFullYear() === d.getFullYear());
    return {
      month: MONTHS[d.getMonth()],
      faturado: inMonth.reduce((s, x) => s + n(x.amount), 0),
      recebido: inMonth.filter((x) => x.status === "PAID").reduce((s, x) => s + n(x.amount), 0),
    };
  });

  const active = clients.filter((c) => c.status === "ACTIVE");
  const count = (s: ContentStatus) => pipeline.find((p) => p.status === s)?._count ?? 0;

  const thisMonth = revenue.at(-1)!;
  const lastMonth = revenue.at(-2)!;

  return {
    stats: {
      activeClients: active.length,
      totalClients: clients.length,
      mrr: active.reduce((s, c) => s + n(c.monthlyFee), 0),
      invoicedThisMonth: thisMonth.faturado,
      growthPct: lastMonth.faturado ? ((thisMonth.faturado - lastMonth.faturado) / lastMonth.faturado) * 100 : 0,
      runningCampaigns: contracts.filter((c) => c.status === "RUNNING").length,
      inApproval: count("IN_APPROVAL"),
    },
    revenue,
    pipeline: (["IDEA", "SCRIPTED", "FILMED", "EDITED", "IN_APPROVAL", "APPROVED", "PUBLISHED"] as ContentStatus[]).map((s) => ({
      status: CONTENT_STATUS_LABEL[s],
      qtd: count(s),
    })),
    deadlines: [
      ...overdueInvoices.map((i) => ({
        id: i.id, title: `Fatura vencida ${i.reference ?? ""}`.trim(), client: i.client.name,
        date: i.dueDate, kind: "Financeiro", late: true,
      })),
      ...upcoming.map((p) => {
        const date = p.dueAt ?? p.scheduledAt ?? now;
        return { id: p.id, title: p.title, client: p.client.name, date, kind: CONTENT_STATUS_LABEL[p.status], late: date < now };
      }),
    ].slice(0, 7),
    campaigns: contracts.map((c) => ({
      id: c.id,
      name: c.name ?? "Contrato",
      client: c.client.name,
      progress: c.deliverables.length
        ? Math.round((c.deliverables.filter((d) => d.status === "DELIVERED").length / c.deliverables.length) * 100)
        : 0,
    })),
    clients: clients.map((c) => ({
      id: c.id, name: c.name, niche: c.niche, status: c.status, monthlyFee: n(c.monthlyFee),
      payment: (c.invoices[0]?.status ?? "PAID") as InvoiceStatus,
    })),
    overdueInvoices: overdueInvoices.map((i) => ({ client: i.client.name, amount: n(i.amount) })),
  };
}

/** Retrato compacto da agência para o assistente (vai no system prompt). */
export async function agencySnapshotForAI(agencyId: string, opts: { finance: boolean }) {
  const d = await getDashboard(agencyId);
  const tasks = await db.task.findMany({
    where: { agencyId, status: { not: "DONE" } },
    include: { assignee: { select: { name: true } }, client: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });
  const fmt = (x: Date) => x.toLocaleDateString("pt-BR");
  // Publicação automática no Instagram: próximas 48h, falhas e publicados nas últimas 24h.
  const now = new Date();
  const [igQueue, igFailed, igDone] = await Promise.all([
    db.contentPiece.findMany({
      where: { agencyId, status: "APPROVED", publishStatus: { in: ["NONE", "PROCESSING"] }, scheduledAt: { lte: new Date(now.getTime() + 2 * 864e5) }, client: { igAccount: { isNot: null } } },
      select: { title: true, scheduledAt: true, client: { select: { name: true } } }, orderBy: { scheduledAt: "asc" }, take: 8,
    }),
    db.contentPiece.findMany({ where: { agencyId, publishStatus: "FAILED" }, select: { title: true, publishError: true, client: { select: { name: true } } }, take: 5 }),
    db.contentPiece.count({ where: { agencyId, publishStatus: "PUBLISHED", publishedAt: { gte: new Date(now.getTime() - 864e5) } } }),
  ]);
  const igLines = [
    `Instagram: ${igDone} publicado(s) nas últimas 24h.`,
    `Fila de publicação (48h): ${igQueue.map((p) => `${p.title} - ${p.client.name} - ${p.scheduledAt ? p.scheduledAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data"}`).join("; ") || "vazia"}.`,
    igFailed.length ? `Publicações com ERRO: ${igFailed.map((p) => `${p.title} (${p.client.name}): ${p.publishError}`).join("; ")}.` : "",
  ];
  // Sem permissão financeira, o assistente não recebe valores (não pode vazar o que a tela esconde).
  const money = opts.finance;
  const deadlines = money ? d.deadlines : d.deadlines.filter((x) => x.kind !== "Financeiro");
  return [
    `Hoje: ${fmt(new Date())}.`,
    money
      ? `MRR (clientes ativos): R$ ${d.stats.mrr}. Clientes ativos: ${d.stats.activeClients} de ${d.stats.totalClients}.`
      : `Clientes ativos: ${d.stats.activeClients} de ${d.stats.totalClients}. (Este usuário não tem acesso a dados financeiros: se perguntar, diga que só Admin/Gestor veem.)`,
    `Clientes: ${d.clients.map((c) => `${c.name} (${c.niche}, ${c.status}${money ? `, R$${c.monthlyFee}/mês, última fatura ${c.payment}` : ""})`).join("; ")}.`,
    money && `Faturas vencidas: ${d.overdueInvoices.map((o) => `${o.client} R$${o.amount}`).join("; ") || "nenhuma"}.`,
    `Pipeline de conteúdo: ${d.pipeline.map((p) => `${p.status}=${p.qtd}`).join(", ")}.`,
    `Próximos prazos: ${deadlines.map((x) => `${x.title} - ${x.client} - ${fmt(x.date)} (${x.kind}${x.late ? ", ATRASADO" : ""})`).join("; ")}.`,
    `Campanhas: ${d.campaigns.map((c) => `${c.name} (${c.client}) ${c.progress}% entregue`).join("; ")}.`,
    money && `Faturamento por mês: ${d.revenue.map((r) => `${r.month} faturado R$${r.faturado} recebido R$${r.recebido}`).join("; ")}.`,
    ...igLines,
    `Tarefas abertas: ${tasks.map((t) => `${t.title} [${t.status}, ${t.priority}] ${t.assignee?.name ?? "sem responsável"}${t.dueDate ? ` até ${fmt(t.dueDate)}` : ""}`).join("; ")}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────── Clientes ────────────────────────────────────

export async function listClients(agencyId: string, filter: { status?: ClientStatus; q?: string }) {
  const rows = await db.client.findMany({
    where: {
      agencyId,
      status: filter.status,
      ...(filter.q && {
        OR: [
          { name: { contains: filter.q, mode: "insensitive" } },
          { niche: { contains: filter.q, mode: "insensitive" } },
          { instagram: { contains: filter.q, mode: "insensitive" } },
        ],
      }),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      invoices: { orderBy: { dueDate: "desc" }, take: 1, select: { status: true } },
      _count: { select: { contents: { where: { status: { not: "PUBLISHED" } } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id, name: c.name, niche: c.niche, instagram: c.instagram, status: c.status,
    monthlyFee: n(c.monthlyFee), payment: c.invoices[0]?.status ?? null, openContents: c._count.contents,
  }));
}

/** Lista simples para selects (Estúdio, Espião, Calendário). */
export async function clientOptions(agencyId: string) {
  const rows = await db.client.findMany({
    where: { agencyId, status: { not: "CHURN" } },
    select: { id: true, name: true, niche: true, instagram: true, brandVoice: true, targetAudience: true, status: true },
    orderBy: { name: "asc" },
  });
  return rows;
}
export type ClientOption = Awaited<ReturnType<typeof clientOptions>>[number];

export async function getClient(agencyId: string, id: string) {
  const c = await db.client.findFirst({
    where: { id, agencyId },
    include: {
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      invoices: { orderBy: { dueDate: "desc" }, take: 12 },
      contents: { orderBy: { scheduledAt: "desc" }, take: 15 },
      contracts: { include: { service: { select: { name: true } }, deliverables: { orderBy: { dueDate: "asc" } } } },
      competitors: { include: { snapshots: { orderBy: { createdAt: "desc" }, take: 1 } } },
      portalUsers: { where: { role: "CLIENT" }, include: { user: { select: { id: true, name: true, email: true } } } },
      igAccount: { select: { username: true, profilePictureUrl: true, autoPublish: true, tokenExpiresAt: true, lastError: true, connectedAt: true } },
    },
  });
  if (!c) return null;
  return {
    ...c,
    avgTicket: c.avgTicket == null ? null : n(c.avgTicket),
    monthlyFee: c.monthlyFee == null ? null : n(c.monthlyFee),
    invoices: c.invoices.map((i) => ({ ...i, amount: n(i.amount) })),
    contracts: c.contracts.map((k) => ({ ...k, price: n(k.price) })),
  };
}
export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClient>>>;

// ─────────────────────────────── Calendário ──────────────────────────────────

export async function listContentInRange(agencyId: string, from: Date, to: Date, clientId?: string) {
  return db.contentPiece.findMany({
    where: { agencyId, clientId: clientId || undefined, scheduledAt: { gte: from, lt: to } },
    include: {
      client: { select: { id: true, name: true, igAccount: { select: { username: true, autoPublish: true } } } },
      approvals: { orderBy: { createdAt: "desc" }, take: 3, include: { reviewer: { select: { name: true } } } },
      assets: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { scheduledAt: "asc" },
  });
}
export type CalendarPiece = Awaited<ReturnType<typeof listContentInRange>>[number];

// ─────────────────────────────── IA / créditos ───────────────────────────────

export async function aiUsage(agencyId: string) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const [agency, used] = await Promise.all([
    db.agency.findUnique({ where: { id: agencyId }, select: { aiCredits: true, name: true } }),
    db.aiGeneration.count({ where: { agencyId, createdAt: { gte: start } } }),
  ]);
  return { used, limit: agency?.aiCredits ?? 0, agencyName: agency?.name ?? "" };
}
