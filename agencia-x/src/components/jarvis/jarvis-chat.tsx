"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Volume2, VolumeX, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { JarvisOrb } from "./jarvis-orb";
import { useJarvis } from "./use-jarvis";
import { ASSISTANT_NAME, cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Resumo do dia: o que precisa da minha atenção?",
  "Quais clientes estão com pagamento atrasado?",
  "Me dá 5 ideias de Reels para a Sorriso Prime",
  "Como está a receita comparada à meta?",
];

const STATE_LABEL = { idle: "Online", listening: "Ouvindo…", thinking: "Processando…", speaking: "Falando…" } as const;

/** UI do chat, usada no painel flutuante (compact) e na página /jarvis (full). */
export function JarvisChat({ variant = "compact" }: { variant?: "compact" | "full" }) {
  const j = useJarvis();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const full = variant === "full";

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [j.messages]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void j.send(input);
    setInput("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Topo: orb + status */}
      <div className={cn("flex flex-col items-center gap-3 border-b border-border", full ? "py-8" : "py-5")}>
        <JarvisOrb state={j.state} size={full ? 200 : 110} />
        <div className="text-center">
          <p className="font-mono text-sm tracking-[0.35em] text-primary text-glow">{ASSISTANT_NAME.toUpperCase()}</p>
          <p className="hud-label mt-1 !text-muted-foreground">{STATE_LABEL[j.state]}</p>
        </div>
      </div>

      {/* Mensagens */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {j.messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-center text-sm text-muted-foreground">Às suas ordens, chefe. Pergunte por texto ou voz.</p>
            <div className={cn("grid gap-2", full && "sm:grid-cols-2")}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => j.send(s)}
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {j.messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[88%] rounded-lg px-3.5 py-2.5 text-sm",
                m.role === "user" ? "bg-primary/15 text-foreground" : "border border-border bg-card",
              )}
            >
              {m.role === "assistant" ? (
                m.content ? <Markdown>{m.content}</Markdown> : <span className="animate-pulse text-primary">▍</span>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
        {j.error && <p className="rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{j.error}</p>}
        <div ref={endRef} />
      </div>

      {/* Entrada */}
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
        <Button type="button" variant="ghost" size="icon" onClick={j.toggleVoice} title="Resposta em voz">
          {j.voiceOn ? <Volume2 className="text-primary" /> : <VolumeX />}
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={j.reset} title="Nova conversa">
          <RotateCcw />
        </Button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          rows={1}
          placeholder={`Fale com ${ASSISTANT_NAME}…`}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-input bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          type="button"
          size="icon"
          variant={j.state === "listening" ? "default" : "outline"}
          onClick={j.listen}
          title="Falar"
          className={cn(j.state === "listening" && "bg-danger")}
        >
          <Mic />
        </Button>
        {j.state === "thinking" || j.state === "speaking" ? (
          <Button type="button" size="icon" onClick={j.stop} title="Parar"><Square /></Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()} title="Enviar"><Send /></Button>
        )}
      </form>
    </div>
  );
}
