/**
 * Dados de demonstração. Na próxima etapa vêm do Prisma (mesmas formas).
 * Mantidos num só lugar para o Dashboard e o Jarvis usarem a mesma "verdade".
 */
export type ClientRow = {
  id: string;
  name: string;
  niche: string;
  instagram: string;
  status: "ACTIVE" | "PAUSED" | "CHURN";
  monthlyFee: number;
  payment: "PAID" | "PENDING" | "OVERDUE";
};

export const clients: ClientRow[] = [
  { id: "c1", name: "Sorriso Prime Odonto", niche: "Odontologia", instagram: "@sorrisoprime", status: "ACTIVE", monthlyFee: 2800, payment: "PAID" },
  { id: "c2", name: "Bella Moda Store", niche: "Moda", instagram: "@bellamodastore", status: "ACTIVE", monthlyFee: 2200, payment: "PENDING" },
  { id: "c3", name: "Iron Fit Academia", niche: "Fitness", instagram: "@ironfit", status: "ACTIVE", monthlyFee: 1900, payment: "PAID" },
  { id: "c4", name: "Casa Nova Imóveis", niche: "Imobiliária", instagram: "@casanovaimoveis", status: "ACTIVE", monthlyFee: 3500, payment: "OVERDUE" },
  { id: "c5", name: "Brasa Burger", niche: "Restaurante", instagram: "@brasaburger", status: "PAUSED", monthlyFee: 1500, payment: "PAID" },
  { id: "c6", name: "WM Energia Solar", niche: "Energia solar", instagram: "@wmenergiasolar", status: "ACTIVE", monthlyFee: 3200, payment: "PAID" },
  { id: "c7", name: "Mentoria Escala", niche: "Infoprodutor", instagram: "@mentoriaescala", status: "CHURN", monthlyFee: 0, payment: "PAID" },
];

export const revenueByMonth = [
  { month: "Jun", receita: 9800, meta: 10000 },
  { month: "Jul", receita: 11200, meta: 11000 },
  { month: "Ago", receita: 12100, meta: 12000 },
  { month: "Set", receita: 13400, meta: 13000 },
  { month: "Out", receita: 14100, meta: 14500 },
  { month: "Nov", receita: 15100, meta: 15000 },
];

export const contentPipeline = [
  { status: "Ideia", qtd: 14 },
  { status: "Roteiro", qtd: 9 },
  { status: "Filmado", qtd: 6 },
  { status: "Editado", qtd: 5 },
  { status: "Aprovação", qtd: 4 },
  { status: "Publicado", qtd: 31 },
];

export const deadlines = [
  { id: "d1", title: "Reels 'Mitos do clareamento'", client: "Sorriso Prime Odonto", due: "Hoje, 18h", kind: "Aprovação" },
  { id: "d2", title: "Carrossel Black Friday", client: "Bella Moda Store", due: "Amanhã", kind: "Edição" },
  { id: "d3", title: "Relatório mensal de tráfego", client: "Casa Nova Imóveis", due: "25/11", kind: "Entrega" },
  { id: "d4", title: "Gravação: bastidores da instalação", client: "WM Energia Solar", due: "26/11", kind: "Gravação" },
  { id: "d5", title: "Cobrança fatura vencida", client: "Casa Nova Imóveis", due: "Atrasado 4d", kind: "Financeiro" },
];

export const campaigns = [
  { name: "Black Friday 2026", client: "Bella Moda Store", progress: 72 },
  { name: "Lançamento clareamento", client: "Sorriso Prime Odonto", progress: 45 },
  { name: "Tráfego leads solar", client: "WM Energia Solar", progress: 88 },
  { name: "Captação de imóveis", client: "Casa Nova Imóveis", progress: 30 },
];

export function agencyStats() {
  const active = clients.filter((c) => c.status === "ACTIVE");
  const mrr = active.reduce((s, c) => s + c.monthlyFee, 0);
  const overdue = clients.filter((c) => c.payment === "OVERDUE");
  const pending = clients.filter((c) => c.payment === "PENDING");
  return {
    activeClients: active.length,
    mrr,
    runningCampaigns: campaigns.length,
    inApproval: contentPipeline.find((p) => p.status === "Aprovação")?.qtd ?? 0,
    overdue,
    pending,
  };
}

/** Texto compacto com o estado da agência, injetado no prompt do Jarvis. */
export function agencySnapshotForAI() {
  const s = agencyStats();
  return [
    `Receita recorrente (MRR) atual: R$ ${s.mrr}. Clientes ativos: ${s.activeClients}.`,
    `Clientes: ${clients.map((c) => `${c.name} (${c.niche}, ${c.status}, R$${c.monthlyFee}/mês, pagamento ${c.payment})`).join("; ")}.`,
    `Pipeline de conteúdo: ${contentPipeline.map((p) => `${p.status}=${p.qtd}`).join(", ")}.`,
    `Prazos: ${deadlines.map((d) => `${d.title} - ${d.client} - ${d.due} (${d.kind})`).join("; ")}.`,
    `Campanhas: ${campaigns.map((c) => `${c.name} (${c.client}) ${c.progress}%`).join("; ")}.`,
    `Receita últimos meses: ${revenueByMonth.map((r) => `${r.month} R$${r.receita}`).join(", ")}.`,
  ].join("\n");
}
