import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { ClientStatus } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CLIENT_STATUS, PAYMENT_STATUS } from "@/components/clients/status";
import { can, requireUser } from "@/lib/session";
import { listClients } from "@/server/queries";
import { brl, cn } from "@/lib/utils";

export const metadata = { title: "Clientes" };

const TABS: { key?: ClientStatus; label: string }[] = [
  { label: "Todos" }, { key: "ACTIVE", label: "Ativos" }, { key: "PAUSED", label: "Pausados" },
  { key: "LEAD", label: "Leads" }, { key: "CHURN", label: "Churn" },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = TABS.find((t) => t.key === sp.status)?.key;
  const q = sp.q?.trim() || undefined;
  const rows = await listClients(user.agencyId, { status, q });
  const showMoney = can(user.role, "finance:read");
  const mrr = rows.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.monthlyFee, 0);

  const tabHref = (key?: string) => {
    const p = new URLSearchParams();
    if (key) p.set("status", key);
    if (q) p.set("q", q);
    return `/clientes${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label">Gestão</p>
          <h1 className="mt-1 text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} cliente(s){showMoney && ` · MRR dos ativos listados: ${brl(mrr)}`}
          </p>
        </div>
        {can(user.role, "clients:write") && (
          <Link href="/clientes/novo" className={buttonVariants()}><Plus /> Novo cliente</Link>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.label}
              href={tabHref(t.key)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition",
                status === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="relative sm:w-72">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q" defaultValue={q} placeholder="Buscar nome, nicho, @..."
            className="h-9 w-full rounded-md border border-input bg-background/60 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop: tabela */}
          <table className="hidden w-full text-sm md:table">
            <thead className="border-b border-border text-left">
              <tr className="hud-label">
                <th className="px-5 py-3 font-normal">Cliente</th>
                <th className="px-5 py-3 font-normal">Nicho</th>
                <th className="px-5 py-3 font-normal">Status</th>
                {showMoney && <th className="px-5 py-3 font-normal">Mensalidade</th>}
                {showMoney && <th className="px-5 py-3 font-normal">Última fatura</th>}
                <th className="px-5 py-3 text-right font-normal">Conteúdos abertos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                  <td className="px-5 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium hover:text-primary">{c.name}</Link>
                    {c.instagram && <p className="text-xs text-muted-foreground">{c.instagram}</p>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{c.niche}</td>
                  <td className="px-5 py-3"><Badge variant={CLIENT_STATUS[c.status].variant}>{CLIENT_STATUS[c.status].label}</Badge></td>
                  {showMoney && <td className="px-5 py-3 font-mono text-xs">{c.monthlyFee ? brl(c.monthlyFee) : "—"}</td>}
                  {showMoney && (
                    <td className="px-5 py-3">
                      {c.payment ? <Badge variant={PAYMENT_STATUS[c.payment].variant}>{PAYMENT_STATUS[c.payment].label}</Badge> : "—"}
                    </td>
                  )}
                  <td className="px-5 py-3 text-right font-mono text-xs">{c.openContents}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: cards */}
          <ul className="divide-y divide-border md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.niche}{showMoney && c.monthlyFee ? ` · ${brl(c.monthlyFee)}` : ""}</p>
                  </div>
                  <Badge variant={CLIENT_STATUS[c.status].variant}>{CLIENT_STATUS[c.status].label}</Badge>
                  {showMoney && c.payment && <Badge variant={PAYMENT_STATUS[c.payment].variant}>{PAYMENT_STATUS[c.payment].label}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
