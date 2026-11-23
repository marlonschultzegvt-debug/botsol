import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AtSign, Calendar, ExternalLink, FileText, Radar, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ClientForm } from "@/components/clients/client-form";
import {
  DeleteClientButton, DeleteNoteButton, InvoiceForm, InvoiceStatusSelect, NoteForm, PortalAccess, InstagramCard,
} from "@/components/clients/client-widgets";
import { CLIENT_STATUS, CONTENT_STATUS, NOTE_TYPE, PAYMENT_STATUS } from "@/components/clients/status";
import { can, requireUser } from "@/lib/session";
import { igConfigured } from "@/lib/instagram";
import { updateClientAction } from "@/server/actions/clients";
import { getClient } from "@/server/queries";
import { brl, cn } from "@/lib/utils";

const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "—");

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const c = await getClient(user.agencyId, (await params).id);
  return { title: c?.name ?? "Cliente" };
}

const IG_NOTICE: Record<string, { kind: "ok" | "erro"; text: string }> = {
  conectado: { kind: "ok", text: "Instagram conectado! Conteúdos aprovados com mídia serão publicados no horário." },
  cancelado: { kind: "erro", text: "Conexão cancelada no Instagram." },
  expirou: { kind: "erro", text: "O login demorou demais ou a sessão mudou. Toque em Conectar de novo." },
  "nao-configurado": { kind: "erro", text: "O app da Meta ainda não foi configurado no sistema." },
  "sem-permissao": { kind: "erro", text: "Só Admin ou Gestor podem conectar o Instagram." },
};

export default async function ClientPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ ig?: string; igmsg?: string }> }) {
  const user = await requireUser();
  const c = await getClient(user.agencyId, (await params).id);
  const sp = await searchParams;
  const igNotice = sp.ig === "erro" ? { kind: "erro" as const, text: `Não foi possível conectar: ${sp.igmsg ?? "erro desconhecido"}` } : sp.ig ? IG_NOTICE[sp.ig] ?? null : null;
  if (!c) notFound();

  const canEdit = can(user.role, "clients:write");
  const canMoney = can(user.role, "finance:read");
  const st = CLIENT_STATUS[c.status];
  const openAmount = c.invoices.filter((i) => i.status === "PENDING" || i.status === "OVERDUE").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      {/* Cabeçalho */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-primary/50 bg-primary/10 text-lg font-semibold text-primary shadow-glow">
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{c.name}</h1>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <span>{c.niche}</span>
              {c.instagram && (
                <a href={`https://instagram.com/${c.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                  <AtSign className="h-3 w-3" />{c.instagram.replace("@", "")}
                </a>
              )}
              {c.website && (
                <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                  <ExternalLink className="h-3 w-3" />site
                </a>
              )}
              <span>Cliente desde {fmtDate(c.startedAt)}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/conteudo?client=${c.id}`} className={buttonVariants({ size: "sm" })}><Sparkles /> Gerar conteúdo</Link>
            <Link href={`/calendario?client=${c.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}><Calendar /> Calendário</Link>
          </div>
        </div>
        {canMoney && (
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <Kpi label="Mensalidade" value={c.monthlyFee ? brl(c.monthlyFee) : "—"} />
            <Kpi label="Em aberto" value={brl(openAmount)} danger={openAmount > 0} />
            <Kpi label="Ticket médio do cliente" value={c.avgTicket ? brl(c.avgTicket) : "—"} />
            <Kpi label="Contratos" value={String(c.contracts.length)} />
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {/* Conteúdos */}
          <Card>
            <CardHeader><CardTitle>Conteúdos recentes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {c.contents.length === 0 && <p className="text-sm text-muted-foreground">Nenhum conteúdo ainda.</p>}
              {c.contents.map((p) => (
                <Link key={p.id} href={`/calendario?client=${c.id}&open=${p.id}${p.scheduledAt ? `&m=${p.scheduledAt.toISOString().slice(0, 7)}` : ""}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", CONTENT_STATUS[p.status].cls)}>{CONTENT_STATUS[p.status].label}</span>
                  <span className="w-20 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{fmtDate(p.scheduledAt)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Financeiro */}
          {canMoney && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Financeiro</CardTitle>
                {can(user.role, "finance:write") && <InvoiceForm clientId={c.id} defaultAmount={c.monthlyFee} />}
              </CardHeader>
              <CardContent>
                {c.invoices.length === 0 && <p className="text-sm text-muted-foreground">Sem faturas.</p>}
                <ul className="divide-y divide-border/60">
                  {c.invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{i.reference ?? "Fatura"}</span>
                      <span className="hidden font-mono text-xs text-muted-foreground sm:inline">venc. {fmtDate(i.dueDate)}</span>
                      <span className="w-24 text-right font-mono text-xs">{brl(i.amount)}</span>
                      {can(user.role, "finance:write") ? (
                        <InvoiceStatusSelect id={i.id} status={i.status} />
                      ) : (
                        <Badge variant={PAYMENT_STATUS[i.status].variant}>{PAYMENT_STATUS[i.status].label}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Contratos e entregas */}
          <Card>
            <CardHeader><CardTitle>Contratos e entregas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {c.contracts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contrato. (Cadastro de contratos chega no módulo Campanhas.)</p>}
              {c.contracts.map((k) => {
                const done = k.deliverables.filter((d) => d.status === "DELIVERED").length;
                const late = k.deliverables.filter((d) => d.status === "LATE").length;
                return (
                  <div key={k.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{k.name ?? k.service.name} <span className="text-muted-foreground">· {k.service.name}</span></span>
                      <span className="font-mono text-xs text-muted-foreground">{done}/{k.deliverables.length} entregues{late ? ` · ${late} atrasada(s)` : ""}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${k.deliverables.length ? (done / k.deliverables.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Dados do cliente */}
          {canEdit && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Dados do cliente</CardTitle>
                {user.role === "ADMIN" && <DeleteClientButton id={c.id} name={c.name} />}
              </CardHeader>
              <CardContent>
                <ClientForm action={updateClientAction.bind(null, c.id)} initial={{
                  name: c.name, niche: c.niche, instagram: c.instagram, tiktok: c.tiktok, website: c.website, goals: c.goals,
                  brandVoice: c.brandVoice, targetAudience: c.targetAudience, avgTicket: c.avgTicket, monthlyFee: c.monthlyFee, status: c.status,
                }}
                submitLabel="Salvar alterações" />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Histórico de interações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NoteForm clientId={c.id} />
              <ol className="relative space-y-4 border-l border-border pl-4">
                {c.notes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>}
                {c.notes.map((note) => (
                  <li key={note.id} className="group relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary shadow-glow" />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {NOTE_TYPE[note.type]} · {note.author.name.split(" ")[0]} · {note.createdAt.toLocaleDateString("pt-BR")}
                      </p>
                      {(note.authorId === user.id || user.role === "ADMIN") && <DeleteNoteButton id={note.id} />}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm">{note.body}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {canEdit && (
            <Card id="conta-instagram">
              <CardHeader><CardTitle>Instagram</CardTitle></CardHeader>
              <CardContent>
                <InstagramCard
                  clientId={c.id}
                  configured={igConfigured()}
                  notice={igNotice}
                  account={c.igAccount ? { ...c.igAccount, tokenExpiresAt: c.igAccount.tokenExpiresAt.toISOString() } : null}
                />
              </CardContent>
            </Card>
          )}

          {canEdit && (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Acesso ao portal</CardTitle>
                <Link href={`/portal?client=${c.id}`} className="text-xs text-primary hover:underline">Ver como cliente →</Link>
              </CardHeader>
              <CardContent>
                <PortalAccess clientId={c.id} users={c.portalUsers.map((m) => m.user)} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Estratégia</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="Objetivos">{c.goals}</Info>
              <Info label="Tom de voz">{c.brandVoice}</Info>
              <Info label="Público-alvo">{c.targetAudience}</Info>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Concorrentes</CardTitle>
              <Link href="/espiao" className="text-xs text-primary hover:underline">Espionar →</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {c.competitors.length === 0 && <p className="text-sm text-muted-foreground">Nenhum concorrente analisado para este cliente.</p>}
              {c.competitors.map((k) => (
                <div key={k.id} className="flex items-center gap-2 text-sm">
                  <Radar className="h-4 w-4 text-primary" />
                  <span className="flex-1">@{k.handle}</span>
                  <span className="text-xs text-muted-foreground">{k.snapshots[0] ? fmtDate(k.snapshots[0].createdAt) : "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="hud-label">{label}</p>
      <p className={cn("mt-1 font-semibold", danger && "text-danger")}>{value}</p>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="hud-label mb-0.5">{label}</p>
      <p className={children ? "" : "text-muted-foreground"}>{children || "Não informado"}</p>
    </div>
  );
}
