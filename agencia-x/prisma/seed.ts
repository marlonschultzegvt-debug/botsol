/**
 * Seed de demonstração: `npm run db:seed`
 * Cria a agência demo com equipe, clientes, contratos, faturas (6 meses),
 * conteúdos no calendário, notas e tarefas. Datas relativas a HOJE.
 *
 * Logins (senha de todos: demo1234):
 *   admin@agenciax.com   (Admin)
 *   gestor@agenciax.com  (Gestor)
 *   redator@agenciax.com (Redator)
 */
import { PrismaClient, type ContentFormat, type ContentStatus, type Platform } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const day = (offset: number, hour = 10) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};
const monthStart = (offset: number, dayOfMonth = 10) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, dayOfMonth, 12);
};

async function main() {
  // Limpa a agência demo anterior (cascata remove o resto).
  await db.agency.deleteMany({ where: { slug: "agencia-x-demo" } });
  await db.user.deleteMany({ where: { email: { endsWith: "@agenciax.com" } } });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const agency = await db.agency.create({
    data: { name: "Agência X", slug: "agencia-x-demo", plan: "PRO", aiCredits: 500 },
  });

  const mkUser = (name: string, email: string, role: "ADMIN" | "MANAGER" | "WRITER" | "EDITOR") =>
    db.user.create({ data: { name, email, passwordHash, memberships: { create: { agencyId: agency.id, role } } } });

  const admin = await mkUser("Marlon Schultze", "admin@agenciax.com", "ADMIN");
  const gestor = await mkUser("Ana Gestora", "gestor@agenciax.com", "MANAGER");
  const redator = await mkUser("Rafa Redator", "redator@agenciax.com", "WRITER");
  const editor = await mkUser("Edu Editor", "editor@agenciax.com", "EDITOR");

  // ── Serviços ──
  const [gestaoIg, trafego, conteudo] = await Promise.all([
    db.service.create({ data: { agencyId: agency.id, name: "Gestão de Instagram", price: 1900, deliverables: [{ tipo: "reels", qtd: 8 }, { tipo: "carrossel", qtd: 4 }] } }),
    db.service.create({ data: { agencyId: agency.id, name: "Tráfego Pago", price: 1500, deliverables: [{ tipo: "relatório", qtd: 1 }] } }),
    db.service.create({ data: { agencyId: agency.id, name: "Criação de Conteúdo", price: 1200, deliverables: [{ tipo: "reels", qtd: 6 }] } }),
  ]);

  // ── Clientes ──
  const clientsData = [
    { name: "Sorriso Prime Odonto", niche: "Odontologia", instagram: "@sorrisoprime", monthlyFee: 2800, status: "ACTIVE", brandVoice: "Acolhedor e especialista", goals: "Agendar avaliações de clareamento e lentes" },
    { name: "Bella Moda Store", niche: "Moda", instagram: "@bellamodastore", monthlyFee: 2200, status: "ACTIVE", brandVoice: "Divertido, próximo, cheio de dicas", goals: "Vender pelo direct e pelo site" },
    { name: "Iron Fit Academia", niche: "Fitness", instagram: "@ironfit", monthlyFee: 1900, status: "ACTIVE", brandVoice: "Motivador e direto", goals: "Matrículas e reativação de alunos" },
    { name: "Casa Nova Imóveis", niche: "Imobiliária", instagram: "@casanovaimoveis", monthlyFee: 3500, status: "ACTIVE", brandVoice: "Confiável e local", goals: "Captar leads de compradores" },
    { name: "Brasa Burger", niche: "Restaurante", instagram: "@brasaburger", monthlyFee: 1500, status: "PAUSED", brandVoice: "Irreverente", goals: "Pedidos no delivery" },
    { name: "WM Energia Solar", niche: "Energia solar", instagram: "@wmenergiasolar", monthlyFee: 3200, status: "ACTIVE", brandVoice: "Técnico mas simples", goals: "Simulações e orçamentos" },
    { name: "Mentoria Escala", niche: "Infoprodutor", instagram: "@mentoriaescala", monthlyFee: 2500, status: "CHURN", brandVoice: "Autoridade", goals: "Lançamento" },
  ] as const;

  const clients = [];
  for (const [i, c] of clientsData.entries()) {
    clients.push(
      await db.client.create({
        data: {
          ...c,
          agencyId: agency.id,
          startedAt: monthStart(-8 + i),
          churnedAt: c.status === "CHURN" ? monthStart(-2) : null,
          targetAudience: "Público local, 25-45 anos",
          avgTicket: [1200, 180, 120, 450000, 45, 22000, 1997][i],
        },
      }),
    );
  }
  const [sorriso, bella, iron, casa, brasa, wm] = clients;

  // ── Contratos (campanhas) + entregas ──
  const contracts = [
    { client: bella, service: conteudo, name: "Black Friday", status: "RUNNING", done: 5, total: 7 },
    { client: sorriso, service: gestaoIg, name: "Lançamento clareamento", status: "RUNNING", done: 4, total: 9 },
    { client: wm, service: trafego, name: "Tráfego leads solar", status: "RUNNING", done: 7, total: 8 },
    { client: casa, service: trafego, name: "Captação de imóveis", status: "RUNNING", done: 3, total: 10 },
    { client: iron, service: gestaoIg, name: "Verão sem desculpas", status: "PLANNING", done: 0, total: 6 },
  ] as const;
  for (const k of contracts) {
    await db.clientService.create({
      data: {
        clientId: k.client.id, serviceId: k.service.id, name: k.name, status: k.status,
        price: k.service.price, startDate: day(-30),
        deliverables: {
          create: Array.from({ length: k.total }, (_, i) => ({
            title: `${k.name} — entrega ${i + 1}`,
            dueDate: day(-20 + i * 4),
            status: i < k.done ? "DELIVERED" : i === k.done && -20 + i * 4 < 0 ? "LATE" : "PENDING",
            deliveredAt: i < k.done ? day(-21 + i * 4) : null,
          })),
        },
      },
    });
  }

  // ── Faturas: 6 meses de histórico ──
  for (let m = -5; m <= 0; m++) {
    for (const c of clients) {
      const activeThen = c.startedAt <= monthStart(m) && (!c.churnedAt || c.churnedAt > monthStart(m));
      if (!activeThen || (c.status === "PAUSED" && m === 0)) continue;
      const due = monthStart(m, 10);
      let status: "PAID" | "PENDING" | "OVERDUE" = "PAID";
      if (m === 0 && c.id === bella.id) status = "PENDING";
      if (m === 0 && c.id === casa.id) status = "OVERDUE";
      await db.invoice.create({
        data: {
          agencyId: agency.id, clientId: c.id, amount: Number(c.monthlyFee), dueDate: due, status,
          paidAt: status === "PAID" ? due : null,
          reference: `Mensalidade ${due.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}`,
        },
      });
    }
  }

  // ── Conteúdos no calendário ──
  type Seed = [number, string, ContentFormat, ContentStatus, (typeof clients)[number], Platform?];
  const pieces: Seed[] = [
    [-12, "3 mitos do clareamento", "REELS", "PUBLISHED", sorriso],
    [-10, "Look de trabalho em 3 versões", "REELS", "PUBLISHED", bella],
    [-9, "Treino de 15 min em casa", "REELS", "PUBLISHED", iron, "TIKTOK"],
    [-7, "Quanto custa morar no centro", "CAROUSEL", "PUBLISHED", casa],
    [-6, "Conta de luz antes x depois", "REELS", "PUBLISHED", wm],
    [-4, "Bastidores do consultório", "STORIES", "PUBLISHED", sorriso],
    [-3, "Erros ao comprar o primeiro imóvel", "CAROUSEL", "PUBLISHED", casa],
    [-2, "Provador: tendências do verão", "REELS", "PUBLISHED", bella],
    [-1, "Mitos da energia solar", "CAROUSEL", "PUBLISHED", wm],
    [0, "Reels 'Mitos do clareamento' parte 2", "REELS", "IN_APPROVAL", sorriso],
    [0, "Teaser Black Friday", "STORIES", "APPROVED", bella],
    [1, "Carrossel Black Friday", "CAROUSEL", "EDITED", bella],
    [2, "Desafio 30 dias", "REELS", "IN_APPROVAL", iron],
    [2, "Tour apartamento 2 quartos", "REELS", "FILMED", casa],
    [3, "Bastidores da instalação", "REELS", "SCRIPTED", wm],
    [4, "Lentes de contato dental: dúvidas", "CAROUSEL", "IN_APPROVAL", sorriso],
    [5, "Black Friday: últimas horas", "REELS", "SCRIPTED", bella],
    [6, "Antes e depois de alunos", "CAROUSEL", "IN_APPROVAL", iron],
    [7, "Financiamento explicado simples", "REELS", "SCRIPTED", casa],
    [8, "Lei 14.300 em 30 segundos", "REELS", "IDEA", wm],
    [9, "Look natalino", "REELS", "IDEA", bella],
    [10, "Por que dente amarela?", "REELS", "IDEA", sorriso],
    [12, "Treino de férias", "SHORTS", "IDEA", iron, "YOUTUBE_SHORTS"],
    [14, "Retrospectiva do ano", "CAROUSEL", "IDEA", wm],
    [16, "Imóveis para investir em 2027", "CAROUSEL", "IDEA", casa],
  ];
  for (const [offset, title, format, status, client, platform] of pieces) {
    await db.contentPiece.create({
      data: {
        agencyId: agency.id, clientId: client.id, title, format, status, platform: platform ?? "INSTAGRAM",
        scheduledAt: day(offset, 18), dueAt: status === "PUBLISHED" ? null : day(offset - 1, 18),
        hashtags: [],
      },
    });
  }

  // ── Notas (histórico de interações) ──
  await db.clientNote.createMany({
    data: [
      { clientId: sorriso.id, authorId: gestor.id, type: "MEETING", body: "Reunião mensal: cliente quer focar em lentes de contato no próximo mês.", createdAt: day(-15) },
      { clientId: sorriso.id, authorId: admin.id, type: "WHATSAPP", body: "Dra. aprovou os roteiros da semana sem ajustes.", createdAt: day(-3) },
      { clientId: casa.id, authorId: admin.id, type: "CALL", body: "Liguei sobre a fatura atrasada; prometeu pagar até sexta.", createdAt: day(-2) },
      { clientId: bella.id, authorId: gestor.id, type: "NOTE", body: "Estoque de Black Friday chega dia 20; priorizar peças jeans.", createdAt: day(-8) },
      { clientId: wm.id, authorId: redator.id, type: "EMAIL", body: "Enviadas 3 opções de gancho para o vídeo da instalação.", createdAt: day(-1) },
    ],
  });

  // ── Tarefas ──
  await db.task.createMany({
    data: [
      { agencyId: agency.id, title: "Editar Reels de Black Friday", status: "DOING", priority: "HIGH", dueDate: day(1), assigneeId: editor.id, clientId: bella.id },
      { agencyId: agency.id, title: "Roteirizar 4 Reels de dezembro", status: "TODO", priority: "MEDIUM", dueDate: day(4), assigneeId: redator.id, clientId: sorriso.id },
      { agencyId: agency.id, title: "Cobrar fatura vencida", status: "TODO", priority: "URGENT", dueDate: day(0), assigneeId: admin.id, clientId: casa.id },
      { agencyId: agency.id, title: "Relatório mensal de tráfego", status: "REVIEW", priority: "MEDIUM", dueDate: day(2), assigneeId: gestor.id, clientId: wm.id },
    ],
  });

  console.log(`✔ Seed concluído. Login: admin@agenciax.com / demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
