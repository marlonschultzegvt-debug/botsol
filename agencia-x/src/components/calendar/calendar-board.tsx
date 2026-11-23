"use client";
/**
 * Calendário editorial: visão mês/semana, filtro por cliente, arrastar e soltar,
 * editor lateral. No celular, a visão de mês vira uma agenda em lista.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
import type { ContentFormat, ContentStatus, Platform } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { CONTENT_STATUS } from "@/components/clients/status";
import { deleteContentAction, moveContentAction, saveContentAction } from "@/server/actions/content";
import { cn } from "@/lib/utils";

export type BoardPiece = {
  id: string; title: string; clientId: string; client: string; format: ContentFormat; platform: Platform;
  status: ContentStatus; scheduledAt: string; script: string | null; caption: string | null;
  /** Respostas do cliente no portal (mais recentes primeiro). */
  approvals?: { decision: "PENDING" | "APPROVED" | "CHANGES_REQUESTED"; comment: string | null; by: string; at: string }[];
};

const FORMATS: Record<ContentFormat, string> = { REELS: "Reels", CAROUSEL: "Carrossel", STATIC: "Post", STORIES: "Stories", SHORTS: "Shorts" };
const PLATFORMS: Record<Platform, string> = { INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE_SHORTS: "YouTube Shorts", LINKEDIN: "LinkedIn" };
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// ── Datas sempre no fuso do navegador ──
const fromKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const localInput = (iso: string) => { const d = new Date(iso); return `${toKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

type Draft = Omit<BoardPiece, "id" | "client" | "scheduledAt"> & { id: string | null; scheduledAt: string };

export function CalendarBoard({
  view, anchorKey, fromKey: gridStartKey, pieces, clients, clientFilter, openId, canEdit,
}: {
  view: "month" | "week"; anchorKey: string; fromKey: string; pieces: BoardPiece[];
  clients: { id: string; name: string }[]; clientFilter: string; openId?: string; canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState(pieces);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Horários dependem do fuso do navegador: a grade só renderiza no cliente (evita erro de hidratação).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => { setItems(pieces); }, [pieces]);

  // ?open=<id> abre o editor direto (link vindo da ficha do cliente).
  useEffect(() => {
    const p = openId && pieces.find((x) => x.id === openId);
    if (p) setDraft({ ...p, scheduledAt: localInput(p.scheduledAt) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const anchor = fromKey(anchorKey);
  const gridStart = fromKey(gridStartKey);
  const days = Array.from({ length: view === "week" ? 7 : 42 }, (_, i) => addDays(gridStart, i));
  const todayKey = toKey(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, BoardPiece[]>();
    for (const p of items) {
      const k = toKey(new Date(p.scheduledAt));
      map.set(k, [...(map.get(k) ?? []), p]);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return map;
  }, [items]);

  // ── Navegação (estado na URL = link compartilhável) ──
  const go = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { view, client: clientFilter || undefined, ...params };
    Object.entries(merged).forEach(([k, v]) => v && q.set(k, v));
    router.push(`${pathname}?${q}`);
  };
  const shift = (dir: number) =>
    view === "week"
      ? go({ w: toKey(addDays(anchor, 7 * dir)) })
      : go({ m: toKey(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1)).slice(0, 7) });
  const goToday = () => go(view === "week" ? { w: todayKey } : { m: todayKey.slice(0, 7) });
  // Mês → semana: abre a semana de hoje se hoje estiver no mês visível; senão, a 1ª semana do mês.
  const switchView = (v: "month" | "week") => {
    if (v === view) return;
    if (v === "week") return go({ view: "week", w: todayKey.startsWith(anchorKey.slice(0, 7)) ? todayKey : anchorKey });
    go({ view: "month", m: anchorKey.slice(0, 7) });
  };

  const title =
    view === "week"
      ? `${gridStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${addDays(gridStart, 6).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
      : anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // ── Ações ──
  const newDraft = (dayKey: string): Draft => ({
    id: null, title: "", clientId: clientFilter || clients[0]?.id || "", format: "REELS", platform: "INSTAGRAM",
    status: "IDEA", scheduledAt: `${dayKey}T18:00`, script: null, caption: null,
  });

  const onDrop = (dayKey: string, id: string) => {
    setDragOver(null);
    const p = items.find((x) => x.id === id);
    if (!p || toKey(new Date(p.scheduledAt)) === dayKey) return;
    const d = new Date(p.scheduledAt);
    const [y, m, dd] = dayKey.split("-").map(Number);
    d.setFullYear(y, m - 1, dd);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, scheduledAt: d.toISOString() } : x))); // otimista
    start(() => moveContentAction(id, dayKey));
  };

  const save = () => {
    if (!draft) return;
    setError(null);
    start(async () => {
      const r = await saveContentAction(draft.id, {
        title: draft.title, clientId: draft.clientId, format: draft.format, platform: draft.platform, status: draft.status,
        scheduledAt: new Date(draft.scheduledAt).toISOString(), script: draft.script ?? "", caption: draft.caption ?? "",
      });
      if (r.error) return setError(r.error);
      setDraft(null);
      router.refresh();
    });
  };

  const remove = () => {
    if (!draft?.id || !confirm("Excluir este conteúdo?")) return;
    const id = draft.id;
    start(async () => {
      await deleteContentAction(id);
      setDraft(null);
      router.refresh();
    });
  };

  const openPiece = (p: BoardPiece) => { setError(null); setDraft({ ...p, scheduledAt: localInput(p.scheduledAt) }); };
  const chipProps = { canEdit, onOpen: openPiece };

  return (
    <div className="space-y-4">
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hud-label">Planejamento</p>
          <h1 className="mt-1 text-2xl font-semibold first-letter:uppercase">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={clientFilter} onChange={(e) => go({ client: e.target.value || undefined, m: view === "month" ? anchorKey.slice(0, 7) : undefined, w: view === "week" ? anchorKey : undefined })} className="w-48">
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="flex rounded-md border border-border p-0.5">
            {(["month", "week"] as const).map((v) => (
              <button key={v} onClick={() => switchView(v)}
                className={cn("rounded px-3 py-1 text-xs", view === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {v === "month" ? "Mês" : "Semana"}
              </button>
            ))}
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Anterior"><ChevronLeft /></Button>
            <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
            <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Próximo"><ChevronRight /></Button>
          </div>
          {canEdit && <Button size="sm" onClick={() => { setError(null); setDraft(newDraft(todayKey)); }}><Plus /> Novo</Button>}
          {pending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
      </div>

      {/* Legenda de status */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(CONTENT_STATUS).map(([k, s]) => (
          <span key={k} className={cn("rounded border px-2 py-0.5 text-[10px]", s.cls)}>{s.label}</span>
        ))}
      </div>

      {!mounted && <Card className="h-[480px] animate-pulse" />}

      {mounted && <>
      {/* Grade (desktop/tablet; e semana em qualquer tela) */}
      <Card className={cn("overflow-hidden", view === "month" && "hidden md:block")}>
        <div className={cn("grid grid-cols-7 border-b border-border", view === "week" && "hidden md:grid")}>
          {WEEKDAYS.map((w) => <div key={w} className="hud-label px-2 py-2 text-center">{w}</div>)}
        </div>
        <div className={cn("grid", view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-7")}>
          {days.map((d, i) => {
            const k = toKey(d);
            const list = byDay.get(k) ?? [];
            const outside = view === "month" && d.getMonth() !== anchor.getMonth();
            const max = view === "month" ? 3 : 99;
            return (
              <div
                key={k}
                onDragOver={(e) => { if (canEdit) { e.preventDefault(); setDragOver(k); } }}
                onDragLeave={() => setDragOver((x) => (x === k ? null : x))}
                onDrop={(e) => { e.preventDefault(); onDrop(k, e.dataTransfer.getData("text/plain")); }}
                onDoubleClick={() => canEdit && (setError(null), setDraft(newDraft(k)))}
                className={cn(
                  "group relative space-y-1 border-border p-1.5",
                  view === "month" ? "min-h-[112px]" : "min-h-[90px] md:min-h-[420px]",
                  (i + 1) % 7 !== 0 && "md:border-r",
                  i < days.length - 7 && "border-b",
                  view === "week" && "border-b md:border-b-0",
                  outside && "bg-muted/20 opacity-50",
                  dragOver === k && "bg-primary/10 ring-1 ring-inset ring-primary",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 font-mono text-[11px]", k === todayKey ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {view === "week" ? <span className="md:hidden">{WEEKDAYS[i]}&nbsp;</span> : null}{d.getDate()}
                  </span>
                  {canEdit && (
                    <button onClick={() => { setError(null); setDraft(newDraft(k)); }} className="text-muted-foreground transition hover:text-primary sm:opacity-0 sm:group-hover:opacity-100" aria-label="Adicionar">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {list.slice(0, max).map((p) => <Chip key={p.id} p={p} big={view === "week"} {...chipProps} />)}
                {list.length > max && (
                  <button onClick={() => go({ view: "week", w: k })} className="w-full text-left text-[10px] text-primary hover:underline">
                    +{list.length - max} mais
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Mobile, visão mês: agenda em lista */}
      {view === "month" && (
        <div className="space-y-3 md:hidden">
          {days.filter((d) => d.getMonth() === anchor.getMonth() && byDay.has(toKey(d))).length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">Nada planejado neste mês.</Card>
          )}
          {days
            .filter((d) => d.getMonth() === anchor.getMonth() && byDay.has(toKey(d)))
            .map((d) => (
              <div key={toKey(d)}>
                <p className={cn("hud-label mb-1.5", toKey(d) === todayKey && "!text-primary")}>
                  {d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
                </p>
                <div className="space-y-1.5">{byDay.get(toKey(d))!.map((p) => <Chip key={p.id} p={p} big {...chipProps} />)}</div>
              </div>
            ))}
        </div>
      )}

      </>}

      {/* Editor lateral */}
      {draft && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setDraft(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-primary/30 bg-card shadow-glow sm:w-[460px]">
            <div className="flex items-center justify-between border-b border-border p-4">
              <p className="font-semibold">{draft.id ? "Editar conteúdo" : "Novo conteúdo"}</p>
              <button onClick={() => setDraft(null)} className="text-muted-foreground hover:text-foreground" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <fieldset disabled={!canEdit} className="flex-1 space-y-4 overflow-y-auto p-4">
              <div><Label>Título</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus /></div>
              <div>
                <Label>Cliente</Label>
                <Select value={draft.clientId} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}>
                  <option value="">— Escolha —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Formato</Label>
                  <Select value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value as ContentFormat })}>
                    {Object.entries(FORMATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Plataforma</Label>
                  <Select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value as Platform })}>
                    {Object.entries(PLATFORMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </Select>
                </div>
              </div>
              <div><Label>Publicação</Label><Input type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(CONTENT_STATUS).map(([k, s]) => (
                    <button key={k} type="button" onClick={() => setDraft({ ...draft, status: k as ContentStatus })}
                      className={cn("rounded border px-2 py-1 text-[11px] transition", draft.status === k ? s.cls + " ring-1 ring-current" : "border-border text-muted-foreground hover:text-foreground")}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {!!draft.approvals?.length && (
                <div className="rounded-md border border-border bg-muted/20 p-3">
                  <p className="hud-label mb-1.5">Resposta do cliente</p>
                  {draft.approvals.map((a, i) => (
                    <p key={i} className={cn("text-xs", a.decision === "CHANGES_REQUESTED" ? "text-warning" : "text-success")}>
                      {a.decision === "CHANGES_REQUESTED" ? "🔁 Pediu ajuste" : "✅ Aprovou"} — {a.by}, {new Date(a.at).toLocaleDateString("pt-BR")}
                      {a.comment && <span className="block text-foreground/80">“{a.comment}”</span>}
                    </p>
                  ))}
                </div>
              )}
              <div><Label>Roteiro</Label><Textarea value={draft.script ?? ""} onChange={(e) => setDraft({ ...draft, script: e.target.value })} className="min-h-[160px] font-mono text-xs" /></div>
              <div><Label>Legenda</Label><Textarea value={draft.caption ?? ""} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} className="min-h-[90px]" /></div>
            </fieldset>
            {canEdit && (
              <div className="flex items-center gap-2 border-t border-border p-4">
                {draft.id && <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" onClick={remove} disabled={pending}><Trash2 /> Excluir</Button>}
                {error && <span className="text-xs text-danger">{error}</span>}
                <Button className="ml-auto" onClick={save} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Salvar</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Item arrastável. Fica FORA do CalendarBoard de propósito: se fosse definido dentro,
 * cada re-render (ex.: realce do dia durante o arraste) recriaria o elemento e o
 * navegador cancelaria o drag.
 */
function Chip({ p, big, canEdit, onOpen }: { p: BoardPiece; big?: boolean; canEdit: boolean; onOpen: (p: BoardPiece) => void }) {
  return (
    <button
      draggable={canEdit}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", p.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={(e) => { e.stopPropagation(); onOpen(p); }}
      className={cn("block w-full rounded border px-1.5 py-1 text-left text-[11px] leading-tight transition hover:brightness-125", CONTENT_STATUS[p.status].cls, canEdit && "cursor-grab active:cursor-grabbing")}
      title={`${p.title} — ${p.client}`}
    >
      <span className="block truncate font-medium">{p.title}</span>
      <span className="block truncate opacity-75">{big ? `${timeOf(p.scheduledAt)} · ${FORMATS[p.format]} · ` : ""}{p.client}</span>
    </button>
  );
}
