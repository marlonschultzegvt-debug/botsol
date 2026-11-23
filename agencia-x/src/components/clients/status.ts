import type { ClientStatus, ContentStatus, InvoiceStatus, NoteType } from "@prisma/client";

type V = "default" | "success" | "warning" | "danger" | "muted";

export const CLIENT_STATUS: Record<ClientStatus, { label: string; variant: V }> = {
  ACTIVE: { label: "Ativo", variant: "success" },
  PAUSED: { label: "Pausado", variant: "warning" },
  CHURN: { label: "Churn", variant: "danger" },
  LEAD: { label: "Lead", variant: "default" },
};

export const PAYMENT_STATUS: Record<InvoiceStatus, { label: string; variant: V }> = {
  PAID: { label: "Pago", variant: "success" },
  PENDING: { label: "Pendente", variant: "warning" },
  OVERDUE: { label: "Atrasado", variant: "danger" },
  CANCELED: { label: "Cancelado", variant: "muted" },
};

export const NOTE_TYPE: Record<NoteType, string> = {
  NOTE: "📝 Nota", CALL: "📞 Ligação", MEETING: "🤝 Reunião", WHATSAPP: "💬 WhatsApp", EMAIL: "✉️ E-mail",
};

/** Cores do pipeline de conteúdo (usadas no calendário). */
export const CONTENT_STATUS: Record<ContentStatus, { label: string; cls: string }> = {
  IDEA: { label: "Ideia", cls: "border-slate-500/50 bg-slate-500/15 text-slate-300" },
  SCRIPTED: { label: "Roteiro", cls: "border-violet-400/50 bg-violet-400/15 text-violet-300" },
  FILMED: { label: "Filmado", cls: "border-sky-400/50 bg-sky-400/15 text-sky-300" },
  EDITED: { label: "Editado", cls: "border-cyan-400/50 bg-cyan-400/15 text-cyan-300" },
  IN_APPROVAL: { label: "Aprovação", cls: "border-amber-400/50 bg-amber-400/15 text-amber-300" },
  APPROVED: { label: "Aprovado", cls: "border-lime-400/50 bg-lime-400/15 text-lime-300" },
  PUBLISHED: { label: "Publicado", cls: "border-emerald-400/50 bg-emerald-400/15 text-emerald-300" },
};
