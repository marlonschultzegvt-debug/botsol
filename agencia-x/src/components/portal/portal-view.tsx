"use client";
/** Portal do cliente: aprovar conteúdos, ver o calendário, enviar arquivos e ver faturas. */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Check, CheckCircle2, ChevronDown, Download, Eye, FileText, Image as ImageIcon, Loader2,
  MessageSquareWarning, Trash2, Upload, Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { CONTENT_STATUS, PAYMENT_STATUS } from "@/components/clients/status";
import { decideContentAction } from "@/server/actions/ops";
import type { PortalData } from "@/server/queries-ops";
import { brl, cn, TZ } from "@/lib/utils";

const FORMAT: Record<string, string> = { REELS: "Reels", CAROUSEL: "Carrossel", STATIC: "Post", STORIES: "Stories", SHORTS: "Shorts" };
const date = (iso: string | null, withTime = false) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", ...(withTime && { hour: "2-digit", minute: "2-digit" }) }) : "—";
const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export function PortalView({ data, preview, viewerName, maxUploadMb }: { data: PortalData; preview: boolean; viewerName: string; maxUploadMb: number }) {
  return (
    <div className="space-y-6">
      {preview && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
          <Eye className="h-4 w-4" /> Pré-visualização: é assim que {data.client.name} vê o portal. Só o cliente pode aprovar.
        </div>
      )}
      <div>
        <p className="hud-label">{data.client.name}</p>
        <h1 className="mt-1 text-2xl font-semibold">Olá{preview ? "" : `, ${viewerName}`}! 👋</h1>
        <p className="text-sm text-muted-foreground">
          {data.pending.length
            ? `Você tem ${data.pending.length} conteúdo(s) esperando sua aprovação.`
            : "Nenhum conteúdo esperando aprovação. Tudo em dia!"}
        </p>
      </div>

      {/* Aprovações */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-primary" /> Para aprovar</h2>
        {data.pending.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nada pendente agora.</Card>}
        {data.pending.map((p) => <ApprovalCard key={p.id} p={p} preview={preview} />)}
      </section>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Próximos 30 dias</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nada agendado.</p>}
            {data.upcoming.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground sm:w-28">{date(p.scheduledAt)}</span>
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", CONTENT_STATUS[p.status].cls)}>{CONTENT_STATUS[p.status].label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Publicados recentemente</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.published.length === 0 && <p className="text-sm text-muted-foreground">Ainda nada publicado.</p>}
            {data.published.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <Check className="h-4 w-4 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">{p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="hover:text-primary">{p.title}</a> : p.title}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{date(p.scheduledAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Files data={data} maxUploadMb={maxUploadMb} />

      {data.invoices.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Faturas</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {data.invoices.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.reference ?? "Fatura"}</span>
                  <span className="font-mono text-xs text-muted-foreground">venc. {new Date(i.dueDate).toLocaleDateString("pt-BR", { timeZone: TZ })}</span>
                  <span className="w-24 text-right font-mono text-xs">{brl(i.amount)}</span>
                  <Badge variant={PAYMENT_STATUS[i.status].variant}>{PAYMENT_STATUS[i.status].label}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApprovalCard({ p, preview }: { p: PortalData["pending"][number]; preview: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (decision: "APPROVED" | "CHANGES_REQUESTED") => start(async () => {
    const r = await decideContentAction(p.id, decision, comment);
    if (r.error) return setError(r.error);
    router.refresh();
  });

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{p.title}</p>
          <p className="text-xs text-muted-foreground">{FORMAT[p.format] ?? p.format} · publicação {date(p.scheduledAt, true)}</p>
        </div>
        <Badge variant="warning">Aguardando você</Badge>
      </div>

      {(p.script || p.caption) && (
        <>
          <button onClick={() => setOpen((v) => !v)} className="mt-3 flex items-center gap-1 text-xs text-primary">
            <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} /> {open ? "Esconder" : "Ver"} roteiro e legenda
          </button>
          {open && (
            <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/20 p-3">
              {p.script && <div><p className="hud-label mb-1">Roteiro</p><Markdown>{p.script}</Markdown></div>}
              {p.caption && <div><p className="hud-label mb-1">Legenda</p><p className="whitespace-pre-line text-sm">{p.caption}</p></div>}
            </div>
          )}
        </>
      )}

      {p.approvals.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {p.approvals.slice(0, 3).map((a, i) => (
            <p key={i}>
              {a.decision === "CHANGES_REQUESTED" ? "🔁 Ajuste pedido" : "✅ Aprovado"} por {a.by} em {new Date(a.at).toLocaleDateString("pt-BR", { timeZone: TZ })}
              {a.comment && <>: “{a.comment}”</>}
            </p>
          ))}
        </div>
      )}

      {!preview && (
        <div className="mt-4 space-y-2">
          {mode === "changes" && (
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} autoFocus
              placeholder="O que precisa mudar? Ex: trocar a música, deixar o gancho mais curto..." className="min-h-[70px]" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {mode === "idle" ? (
              <>
                <Button size="sm" onClick={() => decide("APPROVED")} disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <Check />} Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => setMode("changes")} disabled={pending}><MessageSquareWarning /> Pedir ajuste</Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => decide("CHANGES_REQUESTED")} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Enviar pedido de ajuste</Button>
                <Button size="sm" variant="ghost" onClick={() => { setMode("idle"); setError(null); }}>Cancelar</Button>
              </>
            )}
            {error && <span className="text-xs text-danger">{error}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Files({ data, maxUploadMb }: { data: PortalData; maxUploadMb: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    for (const f of Array.from(files)) {
      if (f.size > maxUploadMb * 1048576) { setError(`${f.name}: maior que ${maxUploadMb} MB.`); continue; }
      setBusy(`Enviando ${f.name}…`);
      const fd = new FormData();
      fd.append("file", f);
      fd.append("clientId", data.client.id);
      const res = await fetch("/api/assets", { method: "POST", body: fd });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Falha no envio.");
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Apagar este arquivo?")) return;
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Falha ao apagar.");
    router.refresh();
  };

  const icon = (m: string) => (m.startsWith("image/") ? ImageIcon : m.startsWith("video/") ? Video : FileText);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Arquivos</CardTitle>
        <div className="flex items-center gap-2">
          {busy && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />{busy}</span>}
          <Button size="sm" variant="outline" onClick={() => input.current?.click()} disabled={!!busy}><Upload /> Enviar</Button>
          <input ref={input} type="file" multiple accept="image/*,video/*,audio/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} data-testid="file-input" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Fotos, vídeos brutos, logos, PDFs — até {maxUploadMb} MB por arquivo.</p>
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        {data.assets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum arquivo ainda.</p>}
        <ul className="divide-y divide-border/60">
          {data.assets.map((a) => {
            const Icon = icon(a.mimeType);
            return (
              <li key={a.id} className="group flex items-center gap-3 py-2 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <a href={`/api/assets/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-primary">{a.fileName}</a>
                <span className="hidden text-xs text-muted-foreground sm:inline">{a.by.split(" ")[0]} · {new Date(a.at).toLocaleDateString("pt-BR", { timeZone: TZ })}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{size(a.sizeBytes)}</span>
                <a href={`/api/assets/${a.id}`} download className="text-muted-foreground hover:text-primary" aria-label="Baixar"><Download className="h-4 w-4" /></a>
                <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label="Apagar"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
