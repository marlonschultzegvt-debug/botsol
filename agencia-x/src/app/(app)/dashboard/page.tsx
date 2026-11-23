import Link from "next/link";
import { AlertTriangle, CalendarClock, DollarSign, Megaphone, Radar, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { PipelineChart, RevenueChart } from "@/components/dashboard/charts";
import { JarvisOrb } from "@/components/jarvis/jarvis-orb";
import { CLIENT_STATUS, PAYMENT_STATUS } from "@/components/clients/status";
import { can, requireUser } from "@/lib/session";
import { getDashboard } from "@/server/queries";
import { ASSISTANT_NAME, brl } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

const shortDate = (d: Date) => {
  const today = new Date();
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 864e5);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 0) return `Atrasado ${-diff}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await getDashboard(user.agencyId);
  const s = d.stats;
  const firstName = user.name.split(" ")[0];
  const money = can(user.role, "finance:read");
  // Sem permissão financeira: some faturas e valores.
  const deadlines = money ? d.deadlines : d.deadlines.filter((x) => x.kind !== "Financeiro");
  const lateCount = deadlines.filter((x) => x.late).length;

  return (
    <div className="space-y-6">
      {/* Briefing do assistente */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row">
          <JarvisOrb size={88} />
          <div className="flex-1 text-center sm:text-left">
            <p className="hud-label">Briefing de {ASSISTANT_NAME}</p>
            <h1 className="mt-1 text-xl font-semibold">
              {greeting()}, {firstName}. {lateCount ? `${lateCount} ${lateCount > 1 ? "itens pedem" : "item pede"} atenção.` : "Tudo sob controle."}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.inApproval} conteúdos aguardando aprovação ·{" "}
              {money &&
                (d.overdueInvoices.length
                  ? `${d.overdueInvoices.length} fatura(s) vencida(s) (${d.overdueInvoices.map((o) => o.client).join(", ")}) · `
                  : "nenhuma fatura vencida · ")}
              {deadlines.length} prazos nos próximos 7 dias.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/espiao" className={buttonVariants({ variant: "outline", size: "sm" })}><Radar /> Espionar</Link>
            <Link href="/conteudo" className={buttonVariants({ size: "sm" })}><Sparkles /> Gerar conteúdo</Link>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Clientes ativos" value={String(s.activeClients)} hint={money ? `MRR ${brl(s.mrr)}` : `${s.totalClients} no total`} icon={Users} />
        {money ? (
          <StatCard
            label="Faturado no mês" value={brl(s.invoicedThisMonth)}
            hint={`${s.growthPct >= 0 ? "+" : ""}${s.growthPct.toFixed(1)}% vs mês anterior`}
            trend={s.growthPct >= 0 ? "up" : "down"} icon={DollarSign}
          />
        ) : (
          <StatCard label="Publicados" value={String(d.pipeline.find((p) => p.status === "Publicado")?.qtd ?? 0)} hint="conteúdos no ar" icon={Sparkles} />
        )}
        <StatCard label="Campanhas" value={String(s.runningCampaigns)} hint="em andamento" icon={Megaphone} />
        <StatCard label="Em aprovação" value={String(s.inApproval)} hint="aguardando cliente" icon={CalendarClock} />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-5">
        {money && <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Faturado x Recebido</CardTitle>
            <CardDescription>Últimos 6 meses — a diferença é o que falta receber</CardDescription>
          </CardHeader>
          <CardContent><RevenueChart data={d.revenue} /></CardContent>
        </Card>}
        <Card className={money ? "lg:col-span-2" : "lg:col-span-5"}>
          <CardHeader>
            <CardTitle>Pipeline de conteúdo</CardTitle>
            <CardDescription>Peças por etapa</CardDescription>
          </CardHeader>
          <CardContent><PipelineChart data={d.pipeline} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Prazos próximos</CardTitle>
            <Link href="/calendario" className="text-xs text-primary hover:underline">Calendário →</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {deadlines.length === 0 && <p className="text-sm text-muted-foreground">Nada para os próximos 7 dias.</p>}
            {deadlines.map((x) => (
              <div key={x.id} className="flex items-start gap-3">
                {x.late ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{x.title}</p>
                  <p className="text-xs text-muted-foreground">{x.client} · {x.kind}</p>
                </div>
                <span className={`shrink-0 font-mono text-[11px] ${x.late ? "text-danger" : "text-muted-foreground"}`}>{shortDate(x.date)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Campanhas em andamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {d.campaigns.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma campanha ativa.</p>}
            {d.campaigns.map((c) => (
              <div key={c.id}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="font-mono text-xs text-primary">{c.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.client} · entregas concluídas</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Clientes</CardTitle>
            <Link href="/clientes" className="text-xs text-primary hover:underline">Ver todos →</Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {d.clients.map((c) => {
              const st = CLIENT_STATUS[c.status];
              const pay = PAYMENT_STATUS[c.payment];
              return (
                <Link key={c.id} href={`/clientes/${c.id}`} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.niche}{money && ` · ${c.monthlyFee ? brl(c.monthlyFee) : "—"}`}</p>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  {money && c.status !== "CHURN" && <Badge variant={pay.variant}>{pay.label}</Badge>}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
