"use client";
/**
 * Campanhas & Serviços: contratos com entregas, catálogo de pacotes e financeiro.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Loader2, Package, Plus, RefreshCw, Receipt, Trash2 } from "lucide-react";
import type { CampaignStatus, DeliverableStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { InvoiceStatusSelect } from "@/components/clients/client-widgets";
import {
  addDeliverableAction, deleteContractAction, deleteDeliverableAction, generateMonthlyInvoicesAction,
  refreshOverdueAction, saveContractAction, saveServiceAction, setDeliverableStatusAction, toggleServiceAction,
  type ContractInput, type ServiceInput,
} from "@/server/actions/ops";
import type { CampaignsData } from "@/server/queries-ops";
import { brl, cn, TZ } from "@/lib/utils";

type Contract = CampaignsData["contracts"][number];
type Service = CampaignsData["services"][number];
type Finance = {
  open: { id: string; client: { id: string; name: string }; amount: number; dueDate: string; reference: string | null; status: "PENDING" | "OVERDUE" | "PAID" | "CANCELED" }[];
  month: { invoiced: number; received: number };
  missingInvoices: number;
};

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; variant: "default" | "success" | "warning" | "muted" }> = {
  PLANNING: { label: "Planejamento", variant: "default" },
  RUNNING: { label: "Em andamento", variant: "success" },
  PAUSED: { label: "Pausado", variant: "warning" },
  DONE: { label: "Concluído", variant: "muted" },
};
const DELIV: Record<DeliverableStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "text-muted-foreground" },
  IN_PROGRESS: { label: "Fazendo", cls: "text-sky-300" },
  DELIVERED: { label: "Entregue", cls: "text-success" },
  LATE: { label: "Atrasada", cls: "text-danger" },
};
const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const today = () => new Date().toISOString().slice(0, 10);

export function CampaignsView({
  data, finance, clients, canManage,
}: { data: CampaignsData; finance: Finance | null; clients: { id: string; name: string }[]; canManage: boolean }) {
  type Tab = "contratos" | "servicos" | "financeiro";
  const [tab, setTab] = useState<Tab>("contratos");
  const tabs: { id: Tab; label: string }[] = [
    { id: "contratos", label: `Contratos (${data.contracts.length})` },
    { id: "servicos", label: `Serviços (${data.services.length})` },
    ...(finance ? [{ id: "financeiro" as const, label: "Financeiro" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label">Gestão</p>
        <h1 className="mt-1 text-2xl font-semibold">Campanhas & Serviços</h1>
        <p className="text-sm text-muted-foreground">Contratos, entregas com prazo, pacotes vendidos e cobrança.</p>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm transition", tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "contratos" && <Contracts contracts={data.contracts} services={data.services} clients={clients} canManage={canManage} />}
      {tab === "servicos" && <Services services={data.services} canManage={canManage} />}
      {tab === "financeiro" && finance && <FinancePanel finance={finance} />}
    </div>
  );
}

// ───────────────────────────────── Contratos ─────────────────────────────────

function Contracts({ contracts, services, clients, canManage }: { contracts: Contract[]; services: Service[]; clients: { id: string; name: string }[]; canManage: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<CampaignStatus | "ACTIVE" | "ALL">("ACTIVE");
  const [draft, setDraft] = useState<(ContractInput & { id: string | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = contracts.filter((k) =>
    filter === "ALL" ? true : filter === "ACTIVE" ? k.status === "RUNNING" || k.status === "PLANNING" : k.status === filter,
  );

  const openNew = () => {
    const s = services.find((x) => x.active);
    setError(null);
    setDraft({ id: null, clientId: clients[0]?.id ?? "", serviceId: s?.id ?? "", name: "", status: "PLANNING", price: s?.price ?? 0, startDate: today(), endDate: "", generateDeliverables: true });
  };
  const openEdit = (k: Contract) => {
    setError(null);
    setDraft({ id: k.id, clientId: k.client.id, serviceId: k.service.id, name: k.name ?? "", status: k.status, price: k.price, startDate: k.startDate.slice(0, 10), endDate: k.endDate?.slice(0, 10) ?? "" });
  };
  const save = () => draft && start(async () => {
    const { id, ...input } = draft;
    const r = await saveContractAction(id, input);
    if (r.error) return setError(r.error);
    setDraft(null);
    router.refresh();
  });
  const remove = () => draft?.id && confirm("Excluir este contrato e todas as entregas?") && start(async () => {
    await deleteContractAction(draft.id!);
    setDraft(null);
    router.refresh();
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-48">
          <option value="ACTIVE">Ativos (planejamento + andamento)</option>
          <option value="ALL">Todos</option>
          {Object.entries(CAMPAIGN_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </Select>
        {canManage && <Button size="sm" onClick={openNew} disabled={!services.length || !clients.length}><Plus /> Novo contrato</Button>}
      </div>
      {!services.length && <p className="text-sm text-warning">Cadastre um serviço na aba Serviços antes de criar contratos.</p>}
      {shown.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum contrato neste filtro.</Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((k) => <ContractCard key={k.id} k={k} canManage={canManage} onEdit={() => openEdit(k)} />)}
      </div>

      <Drawer
        open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar contrato" : "Novo contrato"}
        footer={<>
          {draft?.id && <Button variant="ghost" size="sm" className="text-danger" onClick={remove} disabled={pending}><Trash2 /> Excluir</Button>}
          {error && <span className="text-xs text-danger">{error}</span>}
          <Button className="ml-auto" onClick={save} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Salvar</Button>
        </>}
      >
        {draft && <>
          <div>
            <Label>Cliente</Label>
            <Select value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>Serviço</Label>
            <Select value={draft.serviceId} onChange={(e) => {
              const s = services.find((x) => x.id === e.target.value);
              setDraft({ ...draft, serviceId: e.target.value, price: draft.id ? draft.price : s?.price ?? draft.price });
            }}>
              {services.filter((s) => s.active || s.id === draft.serviceId).map((s) => <option key={s.id} value={s.id}>{s.name} — {brl(s.price)}</option>)}
            </Select>
          </div>
          <div><Label>Nome da campanha (opcional)</Label><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Black Friday 2026" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CampaignStatus })}>
                {Object.entries(CAMPAIGN_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
              </Select>
            </div>
            <div><Label>Valor negociado (R$)</Label><Input type="number" min={0} step="0.01" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
            <div><Label>Início</Label><Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></div>
            <div><Label>Fim (opcional)</Label><Input type="date" value={draft.endDate ?? ""} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></div>
          </div>
          {!draft.id && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-[hsl(var(--primary))]" checked={!!draft.generateDeliverables} onChange={(e) => setDraft({ ...draft, generateDeliverables: e.target.checked })} />
              <span>Criar as entregas do pacote automaticamente<span className="block text-xs text-muted-foreground">Distribuídas nas 4 semanas a partir do início.</span></span>
            </label>
          )}
        </>}
      </Drawer>
    </div>
  );
}

function ContractCard({ k, canManage, onEdit }: { k: Contract; canManage: boolean; onEdit: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today());
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pct = k.deliverables.length ? Math.round((k.done / k.deliverables.length) * 100) : 0;
  const st = CAMPAIGN_STATUS[k.status];

  const setStatus = (id: string, s: DeliverableStatus) => start(async () => { await setDeliverableStatusAction(id, s); router.refresh(); });
  const add = () => start(async () => {
    const r = await addDeliverableAction(k.id, title, due);
    if (r.error) return setErr(r.error);
    setTitle(""); setErr(null); router.refresh();
  });

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{k.name ?? k.service.name}</p>
            <p className="text-xs text-muted-foreground">{k.client.name} · {k.service.name}</p>
          </div>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{k.done}/{k.deliverables.length} entregas{k.late > 0 && <span className="text-danger"> · {k.late} atrasada(s)</span>}</span>
          {canManage && <span className="font-mono">{brl(k.price)}</span>}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-xs text-primary">
            <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} /> Entregas
          </button>
          <div className="flex items-center gap-2">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            {canManage && <Button variant="ghost" size="sm" onClick={onEdit}>Editar</Button>}
          </div>
        </div>
      </div>
      {open && (
        <div className="space-y-1 border-t border-border p-3">
          {k.deliverables.length === 0 && <p className="px-1 text-xs text-muted-foreground">Sem entregas.</p>}
          {k.deliverables.map((d) => (
            <div key={d.id} className="group flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent/40">
              <button
                onClick={() => setStatus(d.id, d.status === "DELIVERED" ? "PENDING" : "DELIVERED")}
                className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", d.status === "DELIVERED" ? "border-success bg-success/20 text-success" : "border-border")}
                aria-label="Marcar entregue"
              >
                {d.status === "DELIVERED" && <Check className="h-3 w-3" />}
              </button>
              <span className={cn("min-w-0 flex-1 truncate", d.status === "DELIVERED" && "text-muted-foreground line-through")}>{d.title}</span>
              <span className={cn("font-mono text-[11px]", DELIV[d.status].cls)}>
                {d.status === "LATE" && <AlertTriangle className="mr-1 inline h-3 w-3" />}{fmt(d.dueDate)}
              </span>
              {canManage && (
                <button onClick={() => confirm("Apagar entrega?") && start(async () => { await deleteDeliverableAction(d.id); router.refresh(); })}
                  className="text-muted-foreground hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label="Apagar"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova entrega" className="h-8 text-xs" />
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 w-36 text-xs" />
            <Button size="sm" variant="outline" onClick={add} disabled={pending || title.trim().length < 2}><Plus /></Button>
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────────────── Serviços ──────────────────────────────────

function Services({ services, canManage }: { services: Service[]; canManage: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<(ServiceInput & { id: string | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => draft && start(async () => {
    const { id, ...input } = draft;
    const r = await saveServiceAction(id, { ...input, deliverables: input.deliverables.filter((d) => String(d.tipo).trim()) });
    if (r.error) return setError(r.error);
    setDraft(null);
    router.refresh();
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { setError(null); setDraft({ id: null, name: "", description: "", price: 0, billingCycle: "MONTHLY", deliverables: [{ tipo: "reels", qtd: 8 }] }); }}>
            <Plus /> Novo serviço
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Card key={s.id} className={cn("p-4", !s.active && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <Package className="h-5 w-5 text-primary" />
              {!s.active && <Badge variant="muted">Inativo</Badge>}
            </div>
            <p className="mt-2 font-medium">{s.name}</p>
            {s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
            <p className="mt-2 text-xl font-semibold">{brl(s.price)}<span className="text-xs font-normal text-muted-foreground">{s.billingCycle === "MONTHLY" ? "/mês" : " (único)"}</span></p>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.deliverables.map((d, i) => <Badge key={i} variant="muted">{d.qtd}× {d.tipo}</Badge>)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{s.activeContracts} contrato(s) ativo(s)</p>
            {canManage && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setError(null); setDraft({ id: s.id, name: s.name, description: s.description ?? "", price: s.price, billingCycle: s.billingCycle as "MONTHLY" | "ONE_TIME", deliverables: s.deliverables }); }}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => start(async () => { await toggleServiceAction(s.id, !s.active); router.refresh(); })}>
                  {s.active ? "Desativar" : "Reativar"}
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Drawer
        open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar serviço" : "Novo serviço"}
        footer={<>
          {error && <span className="text-xs text-danger">{error}</span>}
          <Button className="ml-auto" onClick={save} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Salvar</Button>
        </>}
      >
        {draft && <>
          <div><Label>Nome</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Gestão de Instagram" /></div>
          <div><Label>Descrição</Label><Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="min-h-[60px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Preço (R$)</Label><Input type="number" min={0} step="0.01" value={String(draft.price)} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
            <div>
              <Label>Cobrança</Label>
              <Select value={draft.billingCycle} onChange={(e) => setDraft({ ...draft, billingCycle: e.target.value as "MONTHLY" | "ONE_TIME" })}>
                <option value="MONTHLY">Mensal</option><option value="ONE_TIME">Pagamento único</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Entregas do pacote (por mês)</Label>
            <div className="space-y-2">
              {draft.deliverables.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input type="number" min={1} value={String(d.qtd)} className="w-20" onChange={(e) => setDraft({ ...draft, deliverables: draft.deliverables.map((x, j) => (j === i ? { ...x, qtd: e.target.value } : x)) })} />
                  <Input value={d.tipo} placeholder="reels, carrossel, relatório..." onChange={(e) => setDraft({ ...draft, deliverables: draft.deliverables.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)) })} />
                  <Button variant="ghost" size="icon" onClick={() => setDraft({ ...draft, deliverables: draft.deliverables.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setDraft({ ...draft, deliverables: [...draft.deliverables, { tipo: "", qtd: 1 }] })}><Plus /> Item</Button>
            </div>
          </div>
        </>}
      </Drawer>
    </div>
  );
}

// ───────────────────────────────── Financeiro ────────────────────────────────

function FinancePanel({ finance }: { finance: Finance }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ info?: string; error?: string }>) => start(async () => {
    const r = await fn();
    setMsg(r.error ?? r.info ?? null);
    router.refresh();
  });
  const overdue = finance.open.filter((i) => i.status === "OVERDUE");
  const openTotal = finance.open.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Faturado no mês" value={brl(finance.month.invoiced)} />
        <Kpi label="Recebido no mês" value={brl(finance.month.received)} />
        <Kpi label="Em aberto" value={brl(openTotal)} />
        <Kpi label="Atrasado" value={brl(overdue.reduce((s, i) => s + i.amount, 0))} danger={overdue.length > 0} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => run(generateMonthlyInvoicesAction)} disabled={pending}>
          <Receipt /> Gerar mensalidades do mês{finance.missingInvoices ? ` (${finance.missingInvoices})` : ""}
        </Button>
        <Button size="sm" variant="outline" onClick={() => run(refreshOverdueAction)} disabled={pending}><RefreshCw /> Atualizar atrasadas</Button>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
      <Card>
        <CardHeader><CardTitle>Faturas em aberto</CardTitle></CardHeader>
        <CardContent>
          {finance.open.length === 0 && <p className="text-sm text-muted-foreground">Nada em aberto. 🎉</p>}
          <ul className="divide-y divide-border/60">
            {finance.open.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <a href={`/clientes/${i.client.id}`} className="hover:text-primary">{i.client.name}</a>
                  <span className="text-xs text-muted-foreground"> · {i.reference ?? "Fatura"}</span>
                </span>
                <span className={cn("font-mono text-xs", i.status === "OVERDUE" ? "text-danger" : "text-muted-foreground")}>venc. {fmt(i.dueDate)}</span>
                <span className="w-24 text-right font-mono text-xs">{brl(i.amount)}</span>
                <InvoiceStatusSelect id={i.id} status={i.status} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card className="p-4">
      <p className="hud-label">{label}</p>
      <p className={cn("mt-2 text-xl font-semibold", danger && "text-danger")}>{value}</p>
    </Card>
  );
}
