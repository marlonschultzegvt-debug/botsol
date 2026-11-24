"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbState } from "./jarvis-orb";
import type { JarvisEvent, Proposal } from "@/lib/ai/jarvis-tools";
import type { MediaResult } from "@/server/media";

export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  /** Registro interno enviado ao modelo (ex.: geracao_id), não aparece na tela. */
  note?: string;
  media?: MediaResult[];
  proposal?: Proposal[];
  /** Resultado de cada cartão de agendamento (por índice), depois do toque do usuário. */
  proposalDone?: Record<number, string>;
  /** Ferramenta em execução ("gerar_carrossel"…), para mostrar "Desenhando as artes…". */
  working?: string | null;
};

// Tipos mínimos da Web Speech API (não vêm no lib.dom do TS).
type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
type SpeechCtor = new () => SpeechRec;

const getSpeechCtor = (): SpeechCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const W = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return W.SpeechRecognition ?? W.webkitSpeechRecognition;
};

/**
 * Palavra de ativação. O reconhecimento de voz em português costuma escrever "Jarvis"
 * de vários jeitos ("jarbis", "jarves", "harvis"...), então aceitamos as variações.
 * Funciona com ou sem "e aí" / "ei" / "ok" antes.
 */
const WAKE = /\b(jarvis|jarbis|jarvi|jarves|jarvez|jarviz|jervis|jarbas|harvis|charvis|djarvis)\b/i;

/** Tempo que o Jarvis espera o pedido depois de ser chamado só pelo nome. */
const ARMED_MS = 8000;

/** Bip curto de "estou ouvindo" (Web Audio, sem arquivo). */
function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.22);
  } catch {}
}

/**
 * Hook do assistente: histórico, streaming da resposta, microfone (pt-BR),
 * leitura em voz alta e modo mãos-livres ("E aí, Jarvis").
 * Upgrade futuro: trocar a voz do navegador por ElevenLabs.
 */
export function useJarvis(opts: { onWake?: () => void } = {}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [state, setState] = useState<OrbState>("idle");
  const [voiceOn, setVoiceOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [armed, setArmed] = useState(false); // chamado pelo nome, esperando o pedido
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const onWakeRef = useRef(opts.onWake);
  onWakeRef.current = opts.onWake;

  // Preferências por aparelho (só conveniência local).
  useEffect(() => {
    try {
      setVoiceOn(localStorage.getItem("jarvis-voice") === "1");
      setHandsFree(localStorage.getItem("jarvis-handsfree") === "1");
    } catch {}
  }, []);

  const toggleVoice = () =>
    setVoiceOn((v) => {
      try { localStorage.setItem("jarvis-voice", v ? "0" : "1"); } catch {}
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });

  const toggleHandsFree = () => {
    if (!getSpeechCtor()) return setError("Este navegador não tem reconhecimento de voz. Use o Chrome.");
    // O áudio do bip precisa nascer de um toque do usuário.
    if (!audioRef.current) {
      try { audioRef.current = new AudioContext(); } catch {}
    }
    setError(null);
    setHandsFree((on) => {
      try { localStorage.setItem("jarvis-handsfree", on ? "0" : "1"); } catch {}
      if (!on) {
        // Mãos-livres sem resposta falada não faz sentido: liga a voz junto.
        setVoiceOn(true);
        try { localStorage.setItem("jarvis-voice", "1"); } catch {}
      } else {
        setArmed(false);
      }
      return !on;
    });
  };

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
      const clean = text.replace(/[#*_`>|-]/g, " ").replace(/\s+/g, " ").slice(0, 1200);
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "pt-BR";
      u.rate = 1.05;
      const pt = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("pt"));
      if (pt) u.voice = pt;
      u.onstart = () => setState("speaking");
      u.onend = () => setState("idle");
      u.onerror = () => setState("idle");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [voiceOn],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || state === "thinking") return;
      setError(null);
      const history: ChatMsg[] = [...messages, { role: "user", content }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setState("thinking");
      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.slice(-30).map(({ role, content, note }) => ({ role, content: content || "(mídia)", note })),
          }),
          signal: abortRef.current.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Erro ${res.status}`);
        }
        // NDJSON: um evento por linha.
        let cur: ChatMsg = { role: "assistant", content: "" };
        const update = (patch: Partial<ChatMsg>) => {
          cur = { ...cur, ...patch };
          const snap = cur;
          setMessages((m) => [...m.slice(0, -1), snap]);
        };
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: JarvisEvent;
            try { ev = JSON.parse(line) as JarvisEvent; } catch { continue; }
            if (ev.t === "text") update({ content: cur.content + ev.d });
            else if (ev.t === "tool") update({ working: ev.state === "start" ? ev.name : null });
            else if (ev.t === "media")
              update({
                media: [...(cur.media ?? []), ev.media],
                note: [cur.note, `mídia gerada: ${ev.media.kind} de ${ev.media.clientName}, geracao_id=${ev.media.generationId}, ${ev.media.assets.length} artes`].filter(Boolean).join("; "),
              });
            else if (ev.t === "confirm") update({ proposal: [...(cur.proposal ?? []), ev.proposal] });
            else if (ev.t === "error") setError(ev.msg);
          }
        }
        update({ content: cur.content.trim(), working: null });
        const full = cur.content;
        setState("idle");
        speak(full);
      } catch (e) {
        if ((e as Error).name === "AbortError") return setState("idle");
        setError((e as Error).message);
        setMessages((m) => (m.at(-1)?.content || m.at(-1)?.media ? m : history)); // remove a bolha vazia
        setState("idle");
      }
    },
    [messages, speak, state],
  );

  // Refs para o ouvinte contínuo sempre usar a versão mais nova de send.
  const sendRef = useRef(send);
  sendRef.current = send;

  /** Microfone manual (botão 🎤): uma frase e pronto. */
  const listen = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return setError("Seu navegador não suporta comando de voz (use Chrome ou Edge).");
    if (state === "listening") return recRef.current?.stop();

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setState("idle");
      void sendRef.current(transcript);
    };
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.onerror = () => setState("idle");
    recRef.current = rec;
    window.speechSynthesis?.cancel();
    setState("listening");
    rec.start();
  }, [state]);

  /**
   * Modo mãos-livres: escuta contínua esperando "E aí, Jarvis".
   * - "E aí Jarvis, me dá 3 ideias de Reels" → executa direto.
   * - "E aí Jarvis" (só o nome) → bip, e a próxima frase em até 8s vira o pedido.
   * Pausa enquanto ele pensa ou fala (para não ouvir a própria voz) e volta sozinho.
   */
  const busy = state !== "idle";
  useEffect(() => {
    if (!handsFree || busy) return;
    const Ctor = getSpeechCtor();
    if (!Ctor) return;

    let stopped = false;
    let armedUntil = 0;
    let armedTimer: ReturnType<typeof setTimeout> | undefined;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;

    const fire = (command: string) => {
      armedUntil = 0;
      clearTimeout(armedTimer);
      setArmed(false);
      onWakeRef.current?.();
      void sendRef.current(command);
    };

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const said = e.results[i][0].transcript.trim();
        if (!said) continue;
        const m = said.match(WAKE);
        if (m && m.index !== undefined) {
          // Tudo que veio depois do nome é o pedido.
          const command = said.slice(m.index + m[0].length).replace(/^[\s,.!?:;-]+/, "").trim();
          if (command.length > 2) return fire(command);
          armedUntil = Date.now() + ARMED_MS;
          setArmed(true);
          chime(audioRef.current);
          onWakeRef.current?.();
          clearTimeout(armedTimer);
          armedTimer = setTimeout(() => setArmed(false), ARMED_MS);
        } else if (Date.now() < armedUntil) {
          return fire(said);
        }
      }
    };
    // O Chrome encerra a escuta sozinho depois de um tempo em silêncio: reinicia.
    rec.onend = () => {
      if (stopped) return;
      try { rec.start(); } catch {}
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        stopped = true;
        setHandsFree(false);
        try { localStorage.setItem("jarvis-handsfree", "0"); } catch {}
        setError("O navegador bloqueou o microfone. Permita o microfone para este site e ligue o mãos-livres de novo.");
      }
    };

    try { rec.start(); } catch {}
    return () => {
      stopped = true;
      clearTimeout(armedTimer);
      try { rec.abort(); } catch {}
    };
  }, [handsFree, busy]);

  const stop = () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setState("idle");
  };

  const reset = () => { stop(); setMessages([]); setError(null); };

  /** Anota algo numa mensagem (ex.: cartão de agendamento confirmado) e avisa o modelo pela nota. */
  const annotate = useCallback((index: number, note: string, patch: Partial<ChatMsg> = {}) => {
    setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, ...patch, note: [msg.note, note].filter(Boolean).join("; ") } : msg)));
  }, []);

  return {
    annotate, messages, state, error, voiceOn, toggleVoice, send, listen, stop, reset,
    handsFree, toggleHandsFree, armed,
  };
}

export type JarvisApi = ReturnType<typeof useJarvis>;
