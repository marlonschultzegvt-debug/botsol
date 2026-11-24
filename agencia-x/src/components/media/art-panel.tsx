"use client";
/**
 * Estúdio → "Criar artes": transforma o texto do carrossel em imagens prontas (identidade do cliente),
 * mostra a prévia e só agenda depois do toque em Confirmar.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Images, Loader2, Palette } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import { MediaPreview, ProposalCard } from "@/components/jarvis/media-cards";
import type { MediaResult } from "@/server/media";
import type { ClientOption } from "@/server/queries";

const STYLES = [["impacto", "Impacto (cor da marca)"], ["clean", "Clean (fundo claro)"], ["dark", "Dark"]] as const;
const FORMATS = [["feed", "Feed 4:5"], ["quadrado", "Quadrado 1:1"], ["story", "Stories 9:16"]] as const;

const tomorrow18 = () => {
  const d = new Date(Date.now() + 86_400_000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
  return `${ymd}T18:00`;
};

export function ArtPanel({ clients, clientId: initialClient, text, title }: { clients: ClientOption[]; clientId: string; text: string; title: string }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClient);
  const [style, setStyle] = useState<(typeof STYLES)[number][0]>("impacto");
  const [format, setFormat] = useState<(typeof FORMATS)[number][0]>("feed");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaResult | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [done, setDone] = useState<string | undefined>();

  const create = async () => {
    setBusy(true); setErr(null); setMedia(null); setDone(undefined); setScheduling(false);
    try {
      const r = await fetch("/api/media/carousel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, text, style, format }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
      setMedia(j as MediaResult);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm font-medium"><Images className="h-4 w-4 text-primary" /> Transformar em artes prontas para postar</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label>Cliente</Label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— Escolha —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <Label>Estilo</Label>
          <Select value={style} onChange={(e) => setStyle(e.target.value as typeof style)}>
            {STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <div>
          <Label>Formato</Label>
          <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            {FORMATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={create} disabled={busy || !clientId}>
          {busy ? <Loader2 className="animate-spin" /> : <Palette />} {busy ? "Desenhando as artes…" : "Criar artes"}
        </Button>
        {clientId && (
          <Link href={`/clientes/${clientId}#identidade-visual`} className="text-xs text-muted-foreground hover:text-primary">
            Ajustar cores e logo do cliente →
          </Link>
        )}
      </div>
      {err && <p className="text-xs text-danger">{err}</p>}
      {media && (
        <>
          <MediaPreview media={media} />
          {!scheduling && !done && (
            <Button size="sm" variant="outline" onClick={() => setScheduling(true)}>Aprovar e agendar…</Button>
          )}
          {(scheduling || done) && (
            <ProposalCard
              p={{
                generationId: media.generationId, clientName: media.clientName, title: title || "Carrossel", caption: media.caption,
                scheduledAt: tomorrow18(), mode: "cliente", thumbs: media.assets.slice(0, 3).map((a) => a.id),
              }}
              done={done}
              onDone={(s) => { setDone(s); if (s === "cancelado") { setScheduling(false); setDone(undefined); } else router.refresh(); }}
            />
          )}
        </>
      )}
    </div>
  );
}

export type GalleryItem = { id: string; clientName: string; at: string; assets: { id: string; fileName: string }[]; caption: string; scheduled: boolean; costUsd: number };

/** Últimas artes geradas (pelo Estúdio ou pelo Jarvis). */
export function GeneratedGallery({ items }: { items: GalleryItem[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      {items.map((g) => (
        <div key={g.id}>
          <p className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span><b className="text-foreground">{g.clientName}</b> · {g.at}</span>
            <span>{g.scheduled ? "✓ no calendário" : "não agendado"}</span>
          </p>
          <MediaPreview media={{ generationId: g.id, kind: "carousel", clientId: "", clientName: g.clientName, caption: g.caption, assets: g.assets, costUsd: g.costUsd, format: "feed" }} />
        </div>
      ))}
    </div>
  );
}
