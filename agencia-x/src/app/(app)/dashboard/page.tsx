import Link from "next/link";
import { AlertTriangle, CalendarClock, DollarSign, Megaphone, Sparkles, Users, Radar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { PipelineChart, RevenueChart } from "@/components/dashboard/charts";
import { JarvisOrb } from "@/components/jarvis/jarvis-orb";
import { agencyStats, campaigns, clients, contentPipeline, deadlines, revenueByMonth } from "@/lib/mock-data";
import { ASSISTANT_NAME, brl } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const statusBadge = { ACTIVE: ["success", "Ativo"], PAUSED: ["warning", "Pausado"], CHURN: ["danger", "Churn"] } as const;
const payBadge = { PAID: ["success", "Pago"], PENDING: ["warning", "Pendente"], OVERDUE: ["danger", "Atrasado"] } as const;

export default function DashboardPage() {
  const s = agencyStats();
  const last = revenueByMonth.at(-1)!;
  const prev = revenueByMonth.at(-2)!;
  const growth = (((last.receita - prev.receita) / prev.receita) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Briefing do assistente */}
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-5 p-5 sm:flex-row">
          <JarvisOrb size={88} />
          <div className="flex-1 text-center sm:text-left">
            <p className="hud-label">Briefing de {ASSISTANT_NAME}</p>
            <h1 className="mt-1 text-xl font-semibold">Bom dia, chefe. Tudo sob controle.</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {s.inApproval} conteúdos aguardando aprovação · {s.overdue.length} fatura atrasada ({s.overdue.map((c) => c.name).join(", ")}) ·{" "}
              {deadlines.length} prazos nesta semana.
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
        <StatCard label="Clientes ativos" value={String(s.activeClients)} hint={`${clients.length} no total`} icon={Users} />
        <StatCard label="Receita do mês" value={brl(last.receita)} hint={`+${growth}% vs mês anterior`} trend="up" icon={DollarSign} />
        <StatCard label="Campanhas" value={String(s.runningCampaigns)} hint="em andamento" icon={Megaphone} />
        <StatCard label="Em aprovação" value={String(s.inApproval)} hint="aguardando cliente" icon={CalendarClock} />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Receita x Meta</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent><RevenueChart data={revenueByMonth} /></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline de conteúdo</CardTitle>
            <CardDescription>Peças por etapa</CardDescription>
          </CardHeader>
          <CardContent><PipelineChart data={contentPipeline} /></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Prazos */}
        <Card>
          <CardHeader><CardTitle>Prazos próximos</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deadlines.map((d) => (
              <div key={d.id} className="flex items-start gap-3">
                {d.due.startsWith("Atrasado") ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                ) : (
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{d.title}</p>
                  <p className="text-xs text-muted-foreground">{d.client} · {d.kind}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{d.due}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Campanhas */}
        <Card>
          <CardHeader><CardTitle>Campanhas em andamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {campaigns.map((c) => (
              <div key={c.name}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="font-mono text-xs text-primary">{c.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${c.progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.client}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Clientes */}
        <Card>
          <CardHeader><CardTitle>Clientes</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {clients.map((c) => {
              const [sv, sl] = statusBadge[c.status];
              const [pv, pl] = payBadge[c.payment];
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.niche} · {c.monthlyFee ? brl(c.monthlyFee) : "—"}</p>
                  </div>
                  <Badge variant={sv}>{sl}</Badge>
                  {c.status !== "CHURN" && <Badge variant={pv}>{pl}</Badge>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
