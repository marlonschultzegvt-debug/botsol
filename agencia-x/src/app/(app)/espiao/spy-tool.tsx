"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity, AtSign, History, Clock, Crosshair, Flame, Lightbulb, ListChecks, Loader2, Radar, Target, TrendingUp, Users, Wand2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { JarvisOrb } from "@/components/jarvis/jarvis-orb";
import type { SpyReport } from "@/lib/ai/prompts/spy";
import type { ScrapedProfile } from "@/lib/apify";
import type { ClientOption } from "@/server/queries";

type Result = { report: SpyReport; profile: ScrapedProfile | null; dataSource: "apify" | "manual" | "estimated"; warning?: string };
export type PastAnalysis = { id: string; handle: string; clientId: string | null; client: string | null; at: string; result: Result };

const SOURCE = {
  apify: { label: "Dados reais coletados", variant: "success" },
  manual: { label: "Baseado no que você colou", variant: "warning" },
  estimated: { label: "Estimativa (sem dados coletados)", variant: "warning" },
} as const;

const STEPS = ["Localizando perfil…", "Coletando posts recentes…", "Mapeando formatos e ganchos…", "Cruzando com tendências do nicho…", "Montando relatório…"];

const fmt = (n?: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"));

export function SpyTool({ liveData, clients, past }: { liveData: boolean; clients: ClientOption[]; past: PastAnalysis[] }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [niche, setNiche] = useState("");
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000);
    const client = clients.find((c) => c.id === clientId);

    try {
      const res = await fetch("/api/ai/spy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim(),
          niche: niche || client?.niche || undefined,
          clientId: client?.id,
          manualNotes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na análise");
      setResult(data);
      router.refresh(); // atualiza a lista de análises salvas
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  const r = result?.report;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label">Competitor intelligence</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><Radar className="h-6 w-6 text-primary" /> Espião</h1>
          <p className="text-sm text-muted-foreground">Descubra o que está funcionando para o concorrente e transforme em pauta para o seu cliente.</p>
        </div>
        <Badge variant={liveData ? "success" : "muted"}>
          <span className={liveData ? "h-1.5 w-1.5 rounded-full bg-success" : "h-1.5 w-1.5 rounded-full bg-muted-foreground"} />
          {liveData ? "Coleta real ativa (Apify)" : "Modo estimativa — configure APIFY_TOKEN"}
        </Badge>
      </div>

      {/* Formulário */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={analyze} className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-1">
              <Label>Perfil concorrente *</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={handle} onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))} placeholder="perfil.concorrente" required />
              </div>
            </div>
            <div>
              <Label>Analisar para o cliente</Label>
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Nenhum —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Nicho</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex: odontologia estética" />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={loading || handle.length < 2}>
                {loading ? <Loader2 className="animate-spin" /> : <Crosshair />} {loading ? "Analisando…" : "Espionar perfil"}
              </Button>
            </div>
            <div className="md:col-span-4">
              <Label>Observações / legendas coladas (opcional — melhora muito a análise sem Apify)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px]"
                placeholder="Cole a bio, legendas recentes, o que você notou nos Reels..." />
            </div>
          </form>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {/* Análises salvas: reabrir não gasta crédito */}
      {past.length > 0 && !loading && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Análises salvas</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {past.map((p) => (
              <button
                key={p.id}
                onClick={() => { setResult(p.result); setHandle(p.handle); setClientId(p.clientId ?? ""); setError(null); }}
                className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-left text-xs transition hover:border-primary/50"
              >
                <span className="font-medium text-foreground">@{p.handle}</span>
                {p.client && <span className="text-muted-foreground"> · {p.client}</span>}
                <span className="block text-[10px] text-muted-foreground">{p.at}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Carregando: efeito de varredura */}
      {loading && (
        <Card className="overflow-hidden">
          <div className="relative flex flex-col items-center gap-4 py-12">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="h-1/3 w-full animate-scan bg-gradient-to-b from-transparent via-primary/10 to-transparent" />
            </div>
            <JarvisOrb state="thinking" size={120} />
            <p className="font-mono text-sm text-primary text-glow">{STEPS[step]}</p>
            <p className="text-xs text-muted-foreground">Análises profundas levam de 30s a 2min.</p>
          </div>
        </Card>
      )}

      {/* Relatório */}
      {r && result && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">@{handle.replace(/^@/, "")}</h2>
                <Badge variant={SOURCE[result.dataSource].variant}>{SOURCE[result.dataSource].label}</Badge>
                <Badge variant="muted">Confiança: {r.confianca.nivel}</Badge>
              </div>
              <p className="text-sm text-foreground/90">{r.resumo}</p>
              <p className="text-xs text-muted-foreground">{r.confianca.explicacao}</p>
              {result.warning && <p className="text-xs text-warning">{result.warning}</p>}
            </CardContent>
          </Card>

          {/* Métricas */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {result.profile ? (
              <>
                <Metric icon={Users} label="Seguidores" value={fmt(result.profile.followers)} />
                <Metric icon={Activity} label="Engajamento" value={result.profile.engagementRatePct != null ? `${result.profile.engagementRatePct}%` : "—"} />
                <Metric icon={Flame} label="Média curtidas" value={fmt(result.profile.avgLikes)} />
                <Metric icon={Clock} label="Posts/semana" value={result.profile.postsPerWeek != null ? String(result.profile.postsPerWeek) : "—"} />
              </>
            ) : (
              <>
                <Metric icon={Activity} label="Engajamento (est.)" value={r.metricas.engajamento_estimado} small />
                <Metric icon={Clock} label="Frequência" value={r.metricas.frequencia_postagem} small />
                <Metric icon={Target} label="Nota da bio" value={`${r.perfil.nota_bio}/10`} />
                <Metric icon={TrendingUp} label="Melhor horário" value={r.metricas.melhor_horario} small />
              </>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Perfil & posicionamento</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Field label="Bio">{r.perfil.analise_bio}</Field>
                <Field label="Posicionamento">{r.perfil.posicionamento}</Field>
                <Field label="Público aparente">{r.perfil.publico_aparente}</Field>
                <Field label="Leitura das métricas">{r.metricas.leitura}</Field>
                <div>
                  <p className="hud-label mb-2">Pilares de conteúdo</p>
                  <div className="flex flex-wrap gap-1.5">{r.pilares.map((p) => <Badge key={p}>{p}</Badge>)}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Mix de conteúdo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {r.mix_conteudo.map((m) => (
                  <div key={m.formato}>
                    <div className="mb-1 flex justify-between text-sm"><span>{m.formato}</span><span className="font-mono text-xs text-primary">{m.percentual}%</span></div>
                    <div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${m.percentual}%` }} /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard icon={Flame} title="Formatos que estão performando"
              items={r.formatos_vencedores.map((f) => <><strong>{f.formato}</strong> — {f.por_que_funciona}</>)} />
            <ListCard icon={Wand2} title="Ganchos observados" items={r.ganchos_observados.map((g) => <>“{g}”</>)} />
          </div>

          {/* Ideias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-warning" /> Ideias de conteúdo extraídas</CardTitle>
              <CardDescription>Adaptações estratégicas — clique para virar roteiro no Estúdio.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {r.ideias_conteudo.map((idea) => (
                <div key={idea.titulo} className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="font-medium">{idea.titulo}</p>
                    <Badge variant="muted">{idea.formato}</Badge>
                  </div>
                  <p className="text-sm text-primary">“{idea.gancho}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">{idea.por_que}</p>
                  <Link
                    href={`/conteudo?topic=${encodeURIComponent(`${idea.titulo} — gancho: ${idea.gancho}`)}${clientId ? `&client=${clientId}` : ""}`}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}
                  >
                    <Wand2 /> Gerar roteiro
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <ListCard icon={TrendingUp} title="Tendências do nicho" items={r.tendencias_nicho} />
            <ListCard icon={Target} title="Oportunidades (lacunas)" items={r.oportunidades} />
            <ListCard icon={ListChecks} title="Plano de ação" items={r.plano_acao} ordered />
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, small }: { icon: typeof Users; label: string; value: string; small?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between"><p className="hud-label">{label}</p><Icon className="h-4 w-4 text-primary/70" /></div>
      <p className={small ? "mt-2 text-sm font-medium" : "mt-2 text-xl font-semibold"}>{value}</p>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div><p className="hud-label mb-1">{label}</p><p className="text-foreground/90">{children}</p></div>
  );
}

function ListCard({ icon: Icon, title, items, ordered }: { icon: typeof Users; title: string; items: React.ReactNode[]; ordered?: boolean }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 font-mono text-[11px] text-primary">{ordered ? `${i + 1}.` : "▸"}</span>
              <span className="text-foreground/90">{it}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
