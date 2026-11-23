import { requireUser } from "@/lib/session";
import { clientOptions, listContentInRange } from "@/server/queries";
import { CalendarBoard, type BoardPiece } from "@/components/calendar/calendar-board";

export const metadata = { title: "Calendário" };

/** Primeiro dia (segunda-feira) da semana que contém `d`. */
const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; w?: string; view?: string; client?: string; open?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "week" ? "week" : "month";
  const now = new Date();

  // Âncora: mês (?m=2026-11) ou semana (?w=2026-11-23).
  let anchor: Date;
  if (view === "week" && sp.w && /^\d{4}-\d{2}-\d{2}$/.test(sp.w)) anchor = startOfWeek(new Date(`${sp.w}T12:00:00`));
  else if (sp.m && /^\d{4}-\d{2}$/.test(sp.m)) anchor = new Date(`${sp.m}-01T12:00:00`);
  else anchor = view === "week" ? startOfWeek(now) : new Date(now.getFullYear(), now.getMonth(), 1);

  // Faixa visível (grade do mês começa na segunda antes do dia 1 e tem 6 semanas).
  const from = view === "week" ? anchor : startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const to = new Date(from);
  to.setDate(to.getDate() + (view === "week" ? 7 : 42));
  // Margem de 1 dia para fuso horário.
  const qFrom = new Date(from.getTime() - 864e5);
  const qTo = new Date(to.getTime() + 864e5);

  const [pieces, clients] = await Promise.all([
    listContentInRange(user.agencyId, qFrom, qTo, sp.client),
    clientOptions(user.agencyId),
  ]);

  const board: BoardPiece[] = pieces.map((p) => ({
    id: p.id, title: p.title, clientId: p.clientId, client: p.client.name, format: p.format, platform: p.platform,
    status: p.status, scheduledAt: p.scheduledAt!.toISOString(), script: p.script, caption: p.caption,
    approvals: p.approvals.map((a) => ({ decision: a.decision, comment: a.comment, by: a.reviewer.name, at: a.createdAt.toISOString() })),
    assets: p.assets,
    publish: {
      status: p.publishStatus,
      error: p.publishError,
      url: p.publishedUrl,
      ig: p.client.igAccount ? { username: p.client.igAccount.username, auto: p.client.igAccount.autoPublish } : null,
    },
  }));

  return (
    <CalendarBoard
      view={view}
      anchorKey={key(anchor)}
      fromKey={key(from)}
      pieces={board}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      clientFilter={sp.client ?? ""}
      openId={sp.open}
      canEdit={user.role !== "CLIENT"}
    />
  );
}
