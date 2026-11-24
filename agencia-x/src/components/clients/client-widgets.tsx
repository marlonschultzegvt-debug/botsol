"use client";
/** Pedaços interativos da ficha do cliente (formulários com server actions). */
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  addInvoiceAction, addNoteAction, deleteClientAction, deleteNoteAction, setInvoiceStatusAction, updateBrandAction,
} from "@/server/actions/clients";
import { createPortalAccessAction, revokePortalAccessAction } from "@/server/actions/ops";
import { disconnectInstagramAction, setAutoPublishAction } from "@/server/actions/instagram";
import { TZ } from "@/lib/utils";
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
      className="text-muted-foreground transition hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
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

/** Acesso do cliente ao portal: cria login com senha temporária (mostrada uma vez). */
export function PortalAccess({ clientId, users }: { clientId: string; users: { id: string; name: string; email: string }[] }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = (n: string, e: string) => start(async () => {
    setError(null);
    const r = await createPortalAccessAction(clientId, n, e);
    if (r.error) return setError(r.error);
    setResult({ email: e.trim().toLowerCase(), password: r.password! });
    setName(""); setEmail("");
  });

  return (
    <div className="space-y-3">
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{u.name}<span className="block truncate text-xs text-muted-foreground">{u.email}</span></span>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => create(u.name, u.email)} title="Gerar nova senha">Nova senha</Button>
          <Button size="sm" variant="ghost" className="text-danger" disabled={pending}
            onClick={() => confirm(`Remover o acesso de ${u.name}?`) && start(async () => { await revokePortalAccessAction(clientId, u.id); })}>
            Remover
          </Button>
        </div>
      ))}
      {result && (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
          <p className="font-medium text-success">Acesso criado. Envie ao cliente (a senha não aparece de novo):</p>
          <p className="mt-1 font-mono text-xs">Login: {result.email}<br />Senha: {result.password}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => navigator.clipboard.writeText(
            `Acesse o portal: ${window.location.origin}/login\nE-mail: ${result.email}\nSenha: ${result.password}`,
          )}>Copiar mensagem</Button>
        </div>
      )}
      <div className="grid gap-2">
        <Input placeholder="Nome de quem vai aprovar" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button size="sm" variant="outline" disabled={pending || !name || !email} onClick={() => create(name, email)}>Criar acesso ao portal</Button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

/** Cartão do Instagram na ficha do cliente: conectar, pausar publicações, desconectar. */
export function InstagramCard({
  clientId, account, configured, notice,
}: {
  clientId: string;
  configured: boolean;
  account: { username: string; profilePictureUrl: string | null; autoPublish: boolean; tokenExpiresAt: string; lastError: string | null } | null;
  notice?: { kind: "ok" | "erro"; text: string } | null;
}) {
  const [pending, start] = useTransition();
  const connect = `/api/instagram/connect?client=${clientId}`;

  return (
    <div className="space-y-3">
      {notice && (
        <p className={notice.kind === "ok" ? "rounded-md border border-success/40 bg-success/10 p-2 text-xs text-success" : "rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger"}>
          {notice.text}
        </p>
      )}
      {!configured ? (
        <p className="text-sm text-muted-foreground">
          O app da Meta ainda não foi configurado no sistema (variáveis INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET). Siga o guia de ativação.
        </p>
      ) : !account ? (
        <>
          <p className="text-sm text-muted-foreground">Conecte a conta <b>profissional</b> do Instagram deste cliente para publicar automaticamente os conteúdos aprovados.</p>
          <a href={connect} className="inline-flex h-9 items-center gap-2 rounded-md bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 px-4 text-sm font-semibold text-white">
            Conectar Instagram
          </a>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {account.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={account.profilePictureUrl} alt="" className="h-10 w-10 rounded-full border border-border object-cover" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-sm font-bold text-white">IG</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">@{account.username}</p>
              <p className="text-xs text-muted-foreground">Acesso válido até {new Date(account.tokenExpiresAt).toLocaleDateString("pt-BR", { timeZone: TZ })} · renova sozinho</p>
            </div>
          </div>
          {account.lastError && <p className="text-xs text-danger">{account.lastError}</p>}
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm">
            <span>
              Publicar automaticamente
              <span className="block text-xs text-muted-foreground">Conteúdos <b>Aprovados</b> com mídia vão ao ar no horário agendado.</span>
            </span>
            <input
              type="checkbox"
              checked={account.autoPublish}
              disabled={pending}
              onChange={(e) => start(() => setAutoPublishAction(clientId, e.target.checked))}
              className="h-5 w-5 accent-[hsl(var(--primary))]"
            />
          </label>
          <div className="flex gap-2">
            <a href={connect} className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs hover:bg-accent">Reconectar</a>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              disabled={pending}
              onClick={() => confirm(`Desconectar @${account.username}? As publicações automáticas param.`) && start(() => disconnectInstagramAction(clientId))}
            >
              Desconectar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


// ─────────────────────────── Identidade visual ───────────────────────────
const FONTS = [
  ["montserrat", "Montserrat (moderna)"],
  ["poppins", "Poppins (amigável)"],
  ["playfair", "Playfair (elegante, serifada)"],
  ["spacegrotesk", "Space Grotesk (tech)"],
] as const;
const FONT_CSS: Record<string, string> = {
  montserrat: "Montserrat, system-ui, sans-serif", poppins: "Poppins, system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif", spacegrotesk: "'Space Grotesk', system-ui, sans-serif",
};

export type BrandValues = { primary: string; accent: string; bg: string; text: string; font: string; logoUrl: string | null };

/** Cores, fonte e logo do cliente: aplicadas automaticamente nos carrosséis gerados. */
export function BrandCard({ clientId, name, handle, initial }: { clientId: string; name: string; handle: string | null; initial: BrandValues }) {
  const [state, action, pending] = useActionState(updateBrandAction.bind(null, clientId), undefined);
  const [, startSubmit] = useTransition();
  const [v, setV] = useState(initial);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const set = (k: keyof BrandValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const colors: [keyof BrandValues, string, string][] = [
    ["primary", "brandPrimary", "Principal"], ["accent", "brandAccent", "Destaque"], ["bg", "brandBg", "Fundo claro"], ["text", "brandText", "Texto"],
  ];
  return (
    // onSubmit manual: com action={} o React limpa o formulário e a fonte escolhida "voltava" na tela.
    <form
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startSubmit(() => action(fd)); }}
      className="space-y-3"
    >
      {/* prévia rápida (estilo "impacto") */}
      <div className="relative flex aspect-[4/5] w-full max-w-[220px] flex-col justify-between overflow-hidden rounded-md p-4"
        style={{ background: v.primary, color: v.text, fontFamily: FONT_CSS[v.font] }} aria-label="Prévia da arte">
        <span className="absolute left-0 top-0 h-full w-1.5" style={{ background: v.accent }} />
        <span className="text-[9px] opacity-80">{handle ?? name}</span>
        <div>
          <p className="text-lg font-extrabold leading-tight">Seu título de impacto aqui</p>
          <span className="mt-2 block h-1.5 w-10 rounded" style={{ background: v.accent }} />
        </div>
        <div className="flex items-center justify-between text-[9px]">
          {logoPreview && !removeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo" className="h-5 w-auto max-w-[90px] object-contain" />
          ) : <b>{name}</b>}
          <span style={{ color: v.accent }}>Arraste →</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {colors.map(([k, field, label]) => (
          <label key={field} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
            <input type="color" name={field} value={v[k] as string} onChange={set(k)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
            <span className="min-w-0">
              <span className="block text-muted-foreground">{label}</span>
              <span className="font-mono">{(v[k] as string).toUpperCase()}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <Label htmlFor="brandFont">Fonte</Label>
        <Select id="brandFont" name="brandFont" value={v.font} onChange={set("font")}>
          {FONTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="logo">Logo (PNG com fundo transparente é o ideal)</Label>
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoPreview(URL.createObjectURL(f)); setRemoveLogo(false); } }}
          className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-primary/15 file:px-2 file:py-1 file:text-primary" />
        {initial.logoUrl && (
          <label className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" name="removeLogo" value="1" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} /> Remover logo
          </label>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Salvando…" : "Salvar identidade"}</Button>
        {state?.ok && <span className="text-xs text-success">Salvo ✓</span>}
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
