"use client";
/** Kanban de tarefas internas: arrastar entre colunas, filtros e editor lateral. */
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Plus, Trash2, User } from "lucide-react";
import type { Priority, TaskStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { deleteTaskAction, moveTaskAction, saveTaskAction, type TaskInput } from "@/server/actions/ops";
import type { BoardTask } from "@/server/queries-ops";
import { cn, TZ } from "@/lib/utils";

const COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "TODO", label: "A fazer", accent: "bg-slate-400" },
  { id: "DOING", label: "Fazendo", accent: "bg-sky-400" },
  { id: "REVIEW", label: "Revisão", accent: "bg-amber-400" },
  { id: "DONE", label: "Feito", accent: "bg-emerald-400" },
];
export const PRIORITY: Record<Priority, { label: string; cls: string; rank: number }> = {
  URGENT: { label: "Urgente", cls: "border-danger/50 bg-danger/15 text-danger", rank: 0 },
  HIGH: { label: "Alta", cls: "border-warning/50 bg-warning/15 text-warning", rank: 1 },
  MEDIUM: { label: "Média", cls: "border-primary/40 bg-primary/10 text-primary", rank: 2 },
  LOW: { label: "Baixa", cls: "border-border bg-muted text-muted-foreground", rank: 3 },
};

type Draft = TaskInput & { id: string | null };

export function TaskBoard({
  tasks, members, clients, me,
}: { tasks: BoardTask[]; members: { id: string; name: string }[]; clients: { id: string; name: string }[]; me: string }) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [who, setWho] = useState<string>("all");
  const [clientId, setClientId] = useState("");
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { setItems(tasks); }, [tasks]);

  const filtered = useMemo(
    () =>
      items.filter(
        (t) =>
          (who === "all" || (who === "me" ? t.assignee?.id === me : who === "none" ? !t.assignee : t.assignee?.id === who)) &&
          (!clientId || t.client?.id === clientId),
      ),
    [items, who, clientId, me],
  );

  const columns = COLUMNS.map((c) => ({
    ...c,
    items: filtered
      .filter((t) => t.status === c.id)
      .sort((a, b) => PRIORITY[a.priority].rank - PRIORITY[b.priority].rank || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9")),
  }));

  const drop = (status: TaskStatus, id: string) => {
    setOver(null);
    const t = items.find((x) => x.id === id);
    if (!t || t.status === status) return;
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    start(() => moveTaskAction(id, status));
  };

  const openNew = (status: TaskStatus = "TODO") => {
    setError(null);
    setDraft({ id: null, title: "", description: "", status, priority: "MEDIUM", dueDate: "", assigneeId: me, clientId: clientId || "" });
  };
  const openEdit = (t: BoardTask) => {
    setError(null);
    setDraft({
      id: t.id, title: t.title, description: t.description ?? "", status: t.status, priority: t.priority,
      dueDate: t.dueDate?.slice(0, 10) ?? "", assigneeId: t.assignee?.id ?? "", clientId: t.client?.id ?? "",
    });
  };
  const save = () => draft && start(async () => {
    const { id, ...input } = draft;
    const r = await saveTaskAction(id, input);
    if (r.error) return setError(r.error);
    setDraft(null);
    router.refresh();
  });
  const remove = () => draft?.id && confirm("Excluir esta tarefa?") && start(async () => {
    await deleteTaskAction(draft.id!);
    setDraft(null);
    router.refresh();
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label">Produtividade</p>
          <h1 className="mt-1 text-2xl font-semibold">Tarefas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="w-40">
            <option value="all">Toda a equipe</option>
            <option value="me">Minhas tarefas</option>
            <option value="none">Sem responsável</option>
            {members.filter((m) => m.id !== me).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-44">
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button size="sm" onClick={() => openNew()}><Plus /> Nova tarefa</Button>
          {pending && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
      </div>

      {/* No celular as colunas rolam na horizontal */}
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {columns.map((col) => (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
            onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); drop(col.id, e.dataTransfer.getData("text/plain")); }}
            className={cn(
              "flex w-[80vw] shrink-0 snap-start flex-col rounded-lg border border-border bg-card/50 sm:w-72 lg:w-auto",
              over === col.id && "border-primary/60 bg-primary/5",
            )}
            data-column={col.id}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", col.accent)} />
                <span className="text-sm font-medium">{col.label}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{col.items.length}</span>
              </div>
              <button onClick={() => openNew(col.id)} className="text-muted-foreground hover:text-primary" aria-label={`Nova em ${col.label}`}><Plus className="h-4 w-4" /></button>
            </div>
            <div className="min-h-[120px] flex-1 space-y-2 px-2 pb-2">
              {col.items.map((t) => <TaskCard key={t.id} t={t} onOpen={openEdit} />)}
            </div>
          </div>
        ))}
      </div>

      <Drawer
        open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Editar tarefa" : "Nova tarefa"}
        footer={<>
          {draft?.id && <Button variant="ghost" size="sm" className="text-danger" onClick={remove} disabled={pending}><Trash2 /> Excluir</Button>}
          {error && <span className="text-xs text-danger">{error}</span>}
          <Button className="ml-auto" onClick={save} disabled={pending}>{pending && <Loader2 className="animate-spin" />} Salvar</Button>
        </>}
      >
        {draft && <>
          <div><Label>Título</Label><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus /></div>
          <div><Label>Descrição</Label><Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Coluna</Label>
              <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}>
                {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}>
                {Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={draft.assigneeId ?? ""} onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}>
                <option value="">— Ninguém —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
            <div><Label>Prazo</Label><Input type="date" value={draft.dueDate ?? ""} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} /></div>
          </div>
          <div>
            <Label>Cliente</Label>
            <Select value={draft.clientId ?? ""} onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}>
              <option value="">— Interno —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
        </>}
      </Drawer>
    </div>
  );
}

/** Fora do TaskBoard para não ser recriado durante o arraste (o navegador cancelaria o drag). */
function TaskCard({ t, onOpen }: { t: BoardTask; onOpen: (t: BoardTask) => void }) {
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const late = due && t.status !== "DONE" && due < new Date(new Date().toDateString());
  return (
    <button
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}
      onClick={() => onOpen(t)}
      className={cn("hud-card block w-full cursor-grab rounded-md border border-border p-3 text-left transition hover:border-primary/50 active:cursor-grabbing", t.status === "DONE" && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-medium", t.status === "DONE" && "line-through")}>{t.title}</p>
        <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[10px]", PRIORITY[t.priority].cls)}>{PRIORITY[t.priority].label}</span>
      </div>
      {t.client && <p className="mt-1 text-xs text-primary/80">{t.client.name}</p>}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><User className="h-3 w-3" />{t.assignee?.name.split(" ")[0] ?? "—"}</span>
        {due && (
          <span className={cn("flex items-center gap-1 font-mono", late && "text-danger")}>
            <Calendar className="h-3 w-3" />{due.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" })}
          </span>
        )}
      </div>
    </button>
  );
}
