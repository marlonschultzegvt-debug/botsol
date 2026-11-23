"use client";
import { useActionState } from "react";
import type { ClientStatus } from "@prisma/client";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ActionState } from "@/server/actions/clients";
import { CLIENT_STATUS } from "./status";
import { NICHE_TEMPLATES } from "@/lib/ai/prompts/niches";

export type ClientFormValues = {
  name?: string; niche?: string; instagram?: string | null; tiktok?: string | null; website?: string | null;
  goals?: string | null; brandVoice?: string | null; targetAudience?: string | null;
  avgTicket?: number | null; monthlyFee?: number | null; status?: ClientStatus;
};

/** Formulário de cliente (usado em "Novo" e em "Editar"). */
export function ClientForm({
  action, initial = {}, submitLabel,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial?: ClientFormValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const v = (x?: string | number | null) => (x == null ? "" : String(x));

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="name">Nome do cliente *</Label><Input id="name" name="name" defaultValue={v(initial.name)} required /></div>
      <div>
        <Label htmlFor="niche">Nicho *</Label>
        <Input id="niche" name="niche" list="niches" defaultValue={v(initial.niche)} required />
        <datalist id="niches">{NICHE_TEMPLATES.map((n) => <option key={n.id} value={n.niche.split(" /")[0]} />)}</datalist>
      </div>
      <div><Label htmlFor="instagram">Instagram</Label><Input id="instagram" name="instagram" placeholder="@perfil" defaultValue={v(initial.instagram)} /></div>
      <div><Label htmlFor="tiktok">TikTok</Label><Input id="tiktok" name="tiktok" placeholder="@perfil" defaultValue={v(initial.tiktok)} /></div>
      <div><Label htmlFor="website">Site</Label><Input id="website" name="website" placeholder="https://" defaultValue={v(initial.website)} /></div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={initial.status ?? "ACTIVE"}>
          {Object.entries(CLIENT_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </Select>
      </div>
      <div><Label htmlFor="monthlyFee">Mensalidade (R$)</Label><Input id="monthlyFee" name="monthlyFee" inputMode="decimal" placeholder="2.500" defaultValue={v(initial.monthlyFee)} /></div>
      <div><Label htmlFor="avgTicket">Ticket médio do cliente final (R$)</Label><Input id="avgTicket" name="avgTicket" inputMode="decimal" defaultValue={v(initial.avgTicket)} /></div>
      <div className="sm:col-span-2"><Label htmlFor="goals">Objetivos</Label><Textarea id="goals" name="goals" defaultValue={v(initial.goals)} placeholder="Ex: agendar 30 avaliações por mês" /></div>
      <div><Label htmlFor="brandVoice">Tom de voz (usado pela IA)</Label><Input id="brandVoice" name="brandVoice" defaultValue={v(initial.brandVoice)} placeholder="Ex: acolhedor e especialista" /></div>
      <div><Label htmlFor="targetAudience">Público-alvo (usado pela IA)</Label><Input id="targetAudience" name="targetAudience" defaultValue={v(initial.targetAudience)} placeholder="Ex: mulheres 25-45, Maringá" /></div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm text-success">✓ Salvo</p>}
      </div>
    </form>
  );
}
