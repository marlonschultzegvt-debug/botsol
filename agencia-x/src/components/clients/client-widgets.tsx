"use client";
/** Pedaços interativos da ficha do cliente (formulários com server actions). */
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  addInvoiceAction, addNoteAction, deleteClientAction, deleteNoteAction, setInvoiceStatusAction,
} from "@/server/actions/clients";
import { NOTE_TYPE } from "./status";

export function NoteForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(addNoteAction.bind(null, clientId), undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <Textarea name="body" placeholder="O que aconteceu? Ex: cliente pediu foco em lentes no próximo mês" className="min-h-[70px]" required />
      <div className="flex items-center gap-2">
        <Select name="type" defaultValue="NOTE" className="w-40">
          {Object.entries(NOTE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <SubmitButton size="sm">Registrar</SubmitButton>
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function DeleteNoteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => confirm("Apagar esta nota?") && start(() => deleteNoteAction(id))}
      className="text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"
      aria-label="Apagar nota"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function InvoiceForm({ clientId, defaultAmount }: { clientId: string; defaultAmount?: number | null }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addInvoiceAction.bind(null, clientId), undefined);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>+ Nova fatura</Button>;
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
      <div><Label>Valor</Label><Input name="amount" inputMode="decimal" defaultValue={defaultAmount ?? ""} required /></div>
      <div><Label>Vencimento</Label><Input name="dueDate" type="date" required /></div>
      <div><Label>Referência</Label><Input name="reference" placeholder="Mensalidade 12/2026" /></div>
      <div className="flex items-end gap-2">
        <SubmitButton size="sm">Criar</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
      {state?.error && <p className="text-xs text-danger sm:col-span-4">{state.error}</p>}
    </form>
  );
}

export function InvoiceStatusSelect({ id, status }: { id: string; status: InvoiceStatus }) {
  const [pending, start] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      onChange={(e) => start(() => setInvoiceStatusAction(id, e.target.value as InvoiceStatus))}
      className="h-7 w-28 text-xs"
    >
      <option value="PENDING">Pendente</option>
      <option value="PAID">Pago</option>
      <option value="OVERDUE">Atrasado</option>
      <option value="CANCELED">Cancelado</option>
    </Select>
  );
}

export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-danger hover:bg-danger/10"
      onClick={() => {
        if (prompt(`Isso apaga ${name} e TODO o histórico (conteúdos, faturas, notas). Digite o nome para confirmar:`) === name)
          start(() => deleteClientAction(id));
      }}
    >
      <Trash2 /> Excluir cliente
    </Button>
  );
}
