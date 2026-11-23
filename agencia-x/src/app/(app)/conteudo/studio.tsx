"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clapperboard, Copy, GalleryHorizontal, History, Loader2, MessageSquareText, Sparkles, Square, Zap, CalendarPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { JarvisOrb } from "@/components/jarvis/jarvis-orb";
import { NICHE_TEMPLATES } from "@/lib/ai/prompts/niches";
import type { ContentType } from "@/lib/ai/prompts/content";
import type { ClientOption } from "@/server/queries";
import { saveGenerationToCalendarAction } from "@/server/actions/content";
import { readTextStream } from "@/lib/read-stream";
import { cn } from "@/lib/utils";

const TYPES: { id: ContentType; label: string; icon: typeof Sparkles; desc: string }[] = [
  { id: "reels", label: "Roteiro Reels", icon: Clapperboard, desc: "Reels, TikTok, Shorts" },
  { id: "legenda", label: "Legenda", icon: MessageSquareText, desc: "Texto + hashtags" },
  { id: "carrossel", label: "Carrossel", icon: GalleryHorizontal, desc: "Slide a slide" },
  { id: "hooks", label: "Hooks & CTAs", icon: Zap, desc: "Ganchos de 3s" },
];

const TONES = ["Descontraído e próximo", "Autoridade / especialista", "Divertido com humor", "Inspirador", "Direto e provocativo", "Luxo / sofisticado"];
const GOALS = ["Alcance (viralizar)", "Engajamento (comentários/salvamentos)", "Autoridade", "Gerar leads no direct", "Vender produto/serviço"];

export type HistoryItem = {
  id: string; type: ContentType; topic: string; clientId: string | null; client: string | null; output: string; at: string;
};

const FORMAT_FOR: Record<ContentType, "REELS" | "STATIC" | "CAROUSEL"> = {
  reels: "REELS", legenda: "STATIC", carrossel: "CAROUSEL", hooks: "REELS",
};
const todayIso = () => new Date(Date.now() + 864e5).toISOString().slice(0, 10);

/** Mapeia o nicho do cliente para um template pronto. */
const nicheFor = (niche: string) =>
  NICHE_TEMPLATES.find((n) => n.niche.toLowerCase().includes(niche.toLowerCase().split(" ")[0]))?.id ?? "";

export function ContentStudio({ clients, history }: { clients: ClientOption[]; history: HistoryItem[] }) {
  const router = useRouter();
  const [type, setType] = useState<ContentType>("reels");
  const [clientId, setClientId] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState(GOALS[0]);
  const [tone, setTone] = useState(TONES[0]);
  const [platform, setPlatform] = useState("Instagram");
  const [quantity, setQuantity] = useState(3);
  const [extra, setExtra] = useState("");

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Geração ativa (para salvar no calendário com vínculo ao histórico).
  const [activeGenId, setActiveGenId] = useState<string | null>(null);
  const [justFinished, setJustFinished] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [calClient, setCalClient] = useState("");
  const [calDate, setCalDate] = useState(todayIso());
  const [calMsg, setCalMsg] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(() => {
    // Ideia vinda do Espião: /conteudo?topic=...&client=...
    const q = new URLSearchParams(window.location.search);
    if (q.get("topic")) setTopic(q.get("topic")!);
    if (q.get("client")) onClient(q.get("client")!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Depois de gerar, o servidor salva no histórico; ao recarregar, a mais nova é a ativa.
  useEffect(() => {
    if (justFinished && history[0]) {
      setActiveGenId(history[0].id);
      setJustFinished(false);
    }
  }, [history, justFinished]);

  const onClient = (id: string) => {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) {
      setNicheId(nicheFor(c.niche));
      if (c.targetAudience) setAudience(c.targetAudience);
    }
  };

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 3) return setError("Descreva o tema do conteúdo.");
    setError(null);
    setOutput("");
    setActiveGenId(null);
    setCalOpen(false);
    setCalMsg(null);
    setLoading(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          type, topic, nicheId: nicheId || undefined, clientId: clientId || undefined,
          audience: audience || undefined, goal, tone, platform, quantity, extra: extra || undefined,
        }),
      });
      const full = await readTextStream(res, setOutput);
      if (full.trim() && !full.includes("> ❌")) {
        setJustFinished(true);
        router.refresh(); // traz a geração recém-salva para o histórico
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const saveToCalendar = () => {
    setCalMsg(null);
    startSaving(async () => {
      const r = await saveGenerationToCalendarAction({
        generationId: activeGenId ?? undefined, clientId: calClient || clientId, title: topic,
        format: FORMAT_FOR[type], date: calDate, text: output,
      });
      if (r.error) setCalMsg(r.error);
      else { setCalMsg("✓ Salvo no calendário"); setCalOpen(false); }
    });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label">Módulo de criação</p>
        <h1 className="mt-1 text-2xl font-semibold">Estúdio de Conteúdo</h1>
        <p className="text-sm text-muted-foreground">Roteiros, legendas, carrosséis e ganchos com o Claude, adaptados ao nicho do cliente.</p>
      </div>

      {/* Seletor de tipo */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {TYPES.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            type="button"
            onClick={() => setType(id)}
            className={cn(
              "hud-card flex items-center gap-3 rounded-lg border p-3 text-left transition",
              type === id ? "border-primary/70 shadow-glow" : "border-border hover:border-primary/40",
            )}
          >
            <Icon className={cn("h-5 w-5", type === id ? "text-primary" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Briefing */}
        <Card>
          <CardHeader><CardTitle>Briefing</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={generate} className="space-y-4">
              <div>
                <Label htmlFor="topic">Tema / assunto *</Label>
                <Textarea id="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: 3 mitos sobre clareamento dental que todo mundo acredita" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cliente</Label>
                  <Select value={clientId} onChange={(e) => onClient(e.target.value)}>
                    <option value="">— Nenhum —</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Template de nicho</Label>
                  <Select value={nicheId} onChange={(e) => setNicheId(e.target.value)}>
                    <option value="">— Genérico —</option>
                    {NICHE_TEMPLATES.map((n) => <option key={n.id} value={n.id}>{n.emoji} {n.niche}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <Label>Público-alvo</Label>
                <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Ex: mulheres 25-40, classe B, Maringá" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Objetivo</Label>
                  <Select value={goal} onChange={(e) => setGoal(e.target.value)}>{GOALS.map((g) => <option key={g}>{g}</option>)}</Select>
                </div>
                <div>
                  <Label>Tom de voz</Label>
                  <Select value={tone} onChange={(e) => setTone(e.target.value)}>{TONES.map((t) => <option key={t}>{t}</option>)}</Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plataforma</Label>
                  <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    {["Instagram", "TikTok", "YouTube Shorts", "LinkedIn"].map((p) => <option key={p}>{p}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min={1} max={10} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} />
                </div>
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} className="min-h-[60px]"
                  placeholder="Promoção, produto específico, palavras proibidas..." />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              {loading ? (
                <Button type="button" variant="secondary" className="w-full" onClick={() => abortRef.current?.abort()}>
                  <Square /> Parar geração
                </Button>
              ) : (
                <Button type="submit" className="w-full"><Sparkles /> Gerar com IA</Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Resultado */}
        <div className="min-w-0 space-y-4">
          <Card className="min-h-[420px]">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />} Resultado
              </CardTitle>
              {output && !loading && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setCalClient(clientId); setCalOpen((v) => !v); }}>
                    <CalendarPlus /> Calendário
                  </Button>
                  <Button variant="outline" size="sm" onClick={copy}>
                    {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {calOpen && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div className="min-w-40 flex-1">
                    <Label>Cliente</Label>
                    <Select value={calClient} onChange={(e) => setCalClient(e.target.value)}>
                      <option value="">— Escolha —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Publicar em</Label>
                    <Input type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={saveToCalendar} disabled={saving || !calClient}>
                    {saving ? <Loader2 className="animate-spin" /> : <CalendarPlus />} Salvar como &quot;Roteiro&quot;
                  </Button>
                </div>
              )}
              {calMsg && <p className={cn("mb-3 text-sm", calMsg.startsWith("✓") ? "text-success" : "text-danger")}>{calMsg}</p>}
              {output ? (
                <Markdown>{output}</Markdown>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                  <JarvisOrb size={96} state={loading ? "thinking" : "idle"} />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {loading ? "Analisando o nicho e escrevendo…" : "Preencha o briefing e clique em Gerar. O texto aparece aqui em tempo real."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico recente</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {history.map((h) => (
                  <button key={h.id} onClick={() => { setOutput(h.output); setActiveGenId(h.id); setType(h.type); setTopic(h.topic); if (h.clientId) setClientId(h.clientId); setCalMsg(null); }}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <span className="truncate">
                      <span className="mr-2 font-mono text-[10px] uppercase text-primary">{h.type}</span>{h.topic}
                      {h.client && <span className="ml-2 text-xs text-muted-foreground">· {h.client}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{h.at}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
