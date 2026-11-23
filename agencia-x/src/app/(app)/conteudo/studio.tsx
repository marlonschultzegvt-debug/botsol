"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Copy, GalleryHorizontal, History, Loader2, MessageSquareText, Sparkles, Square, Zap, CalendarPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { JarvisOrb } from "@/components/jarvis/jarvis-orb";
import { NICHE_TEMPLATES } from "@/lib/ai/prompts/niches";
import type { ContentType } from "@/lib/ai/prompts/content";
import { clients } from "@/lib/mock-data";
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

type HistoryItem = { id: string; type: ContentType; topic: string; output: string; at: string };
const HISTORY_KEY = "studio-history";

/** Mapeia o nicho do cliente para um template pronto. */
const nicheFor = (niche: string) =>
  NICHE_TEMPLATES.find((n) => n.niche.toLowerCase().includes(niche.toLowerCase().split(" ")[0]))?.id ?? "";

export function ContentStudio() {
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Histórico local (conveniência). Na etapa do banco: tabela AiGeneration.
  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")); } catch {}
    // Ideia vinda do Espião: /conteudo?topic=...
    const t = new URLSearchParams(window.location.search).get("topic");
    if (t) setTopic(t);
  }, []);
  const saveHistory = (item: HistoryItem) => {
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
  };

  const onClient = (id: string) => {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) setNicheId(nicheFor(c.niche));
  };

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (topic.trim().length < 3) return setError("Descreva o tema do conteúdo.");
    setError(null);
    setOutput("");
    setLoading(true);
    abortRef.current = new AbortController();
    const client = clients.find((c) => c.id === clientId);

    try {
      const res = await fetch("/api/ai/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          type, topic, nicheId: nicheId || undefined, nicheFree: client?.niche,
          clientName: client?.name, audience: audience || undefined, goal, tone, platform, quantity,
          extra: extra || undefined,
        }),
      });
      const full = await readTextStream(res, setOutput);
      if (full.trim()) saveHistory({ id: crypto.randomUUID(), type, topic, output: full, at: new Date().toLocaleString("pt-BR") });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

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
                    {clients.filter((c) => c.status !== "CHURN").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                  <Button variant="outline" size="sm" disabled title="Disponível na etapa do banco de dados">
                    <CalendarPlus /> Calendário
                  </Button>
                  <Button variant="outline" size="sm" onClick={copy}>
                    {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
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
                {history.slice(0, 8).map((h) => (
                  <button key={h.id} onClick={() => setOutput(h.output)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <span className="truncate">
                      <span className="mr-2 font-mono text-[10px] uppercase text-primary">{h.type}</span>{h.topic}
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
