"use client";
/**
 * Cartões do chat do Jarvis: prévia das artes geradas e confirmação de agendamento.
 * Agendar SEMPRE passa por um toque do usuário aqui — o Jarvis nunca agenda/publica sozinho.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarCheck, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Proposal } from "@/lib/ai/jarvis-tools";
import type { MediaResult } from "@/server/media";
import { scheduleMediaAction } from "@/server/actions/media";
import { cn, TZ } from "@/lib/utils";

export function MediaPreview({ media }: { media: MediaResult }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="mt-2 rounded-md border border-primary/30 bg-background/40 p-2">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          Carrossel · <b className="text-foreground">{media.clientName}</b> · {media.assets.length} artes
        </span>
        <a href={`/api/media/zip?g=${media.generationId}`} className="flex items-center gap-1 text-primary hover:underline">
          <Download className="h-3.5 w-3.5" /> ZIP
        </a>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {media.assets.map((a, i) => (
          <button key={a.id} type="button" onClick={() => setOpen(i)} className="shrink-0" aria-label={`Ver arte ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/assets/${a.id}`} alt={`Arte ${i + 1}`} loading="lazy" className="h-28 w-auto rounded border border-border object-cover" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(null)}>
          <button type="button" className="absolute right-4 top-4 text-white" aria-label="Fechar"><X /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/assets/${media.assets[open].id}`} alt="" className="max-h-full max-w-full rounded" />
        </div>
      )}
    </div>
  );
}

const fmt = (v: string) => {
  const d = new Date(`${v}:00-03:00`);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
};

export function ProposalCard({ p, done, onDone }: { p: Proposal; done?: string; onDone: (status: string, note: string) => void }) {
  const [when, setWhen] = useState(p.scheduledAt);
  const [mode, setMode] = useState(p.mode);
  const [caption, setCaption] = useState(p.caption);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="mt-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
        {done === "cancelado" ? "Agendamento cancelado." : <>✓ {done} <Link href="/calendario" className="text-primary hover:underline">Abrir calendário</Link></>}
      </div>
    );
  }

  const confirm = () =>
    start(async () => {
      setErr(null);
      const r = await scheduleMediaAction({ generationId: p.generationId, title: p.title, caption, scheduledAt: `${when}:00-03:00`, mode });
      if (r.error) return setErr(r.error);
      const label = mode === "cliente" ? `Enviado para aprovação do cliente (${fmt(when)}).` : `Agendado para ${fmt(when)}.`;
      onDone(label, `usuário CONFIRMOU o agendamento: ${p.title}, ${when}, modo ${mode}, conteudo_id=${r.contentId}`);
    });

  return (
    <div className="mt-2 space-y-2 rounded-md border border-warning/50 bg-warning/5 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <CalendarCheck className="h-4 w-4 text-warning" /> Confirmar agendamento? <span className="text-muted-foreground">({p.clientName})</span>
      </p>
      <div className="flex gap-1">
        {p.thumbs.map((id) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={`/api/assets/${id}`} alt="" className="h-14 w-auto rounded border border-border" />
        ))}
      </div>
      <p className="font-medium">{p.title}</p>
      <label className="block">
        <span className="text-muted-foreground">Data e hora (Brasília)</span>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
          className="mt-1 w-full rounded border border-input bg-background/60 px-2 py-1.5" />
      </label>
      <label className="block">
        <span className="text-muted-foreground">Legenda</span>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3}
          className="mt-1 w-full rounded border border-input bg-background/60 px-2 py-1.5" />
      </label>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Como agendar">
        {([["cliente", "Cliente aprova no portal"], ["aprovado", "Já aprovado: publicar no horário"]] as const).map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
            className={cn("rounded border px-2 py-1.5 text-left", mode === v ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
            {l}
          </button>
        ))}
      </div>
      {err && <p className="text-danger">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={confirm} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Confirmar
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => onDone("cancelado", "usuário CANCELOU a proposta de agendamento")}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
