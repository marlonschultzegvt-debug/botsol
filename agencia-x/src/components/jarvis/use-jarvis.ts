"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { readTextStream } from "@/lib/read-stream";
import type { OrbState } from "./jarvis-orb";

export type ChatMsg = { role: "user" | "assistant"; content: string };

// Tipos mínimos da Web Speech API (não vêm no lib.dom do TS).
type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};

/**
 * Hook do assistente: histórico, streaming da resposta, microfone (pt-BR)
 * e leitura em voz alta (speechSynthesis do navegador).
 * Upgrade futuro: trocar a voz do navegador por ElevenLabs.
 */
export function useJarvis() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [state, setState] = useState<OrbState>("idle");
  const [voiceOn, setVoiceOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Preferência de voz por usuário (só conveniência local).
  useEffect(() => {
    try { setVoiceOn(localStorage.getItem("jarvis-voice") === "1"); } catch {}
  }, []);
  const toggleVoice = () =>
    setVoiceOn((v) => {
      try { localStorage.setItem("jarvis-voice", v ? "0" : "1"); } catch {}
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });

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
          body: JSON.stringify({ messages: history.slice(-30) }),
          signal: abortRef.current.signal,
        });
        const full = await readTextStream(res, (t) =>
          setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: t }]),
        );
        setState("idle");
        speak(full);
      } catch (e) {
        if ((e as Error).name === "AbortError") return setState("idle");
        setError((e as Error).message);
        setMessages(history); // remove a bolha vazia
        setState("idle");
      }
    },
    [messages, speak, state],
  );

  const listen = useCallback(() => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return setError("Seu navegador não suporta comando de voz (use Chrome ou Edge).");
    if (state === "listening") return recRef.current?.stop();

    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setState("idle");
      void send(transcript);
    };
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    rec.onerror = () => setState("idle");
    recRef.current = rec;
    window.speechSynthesis?.cancel();
    setState("listening");
    rec.start();
  }, [send, state]);

  const stop = () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    setState("idle");
  };

  const reset = () => { stop(); setMessages([]); setError(null); };

  return { messages, state, error, voiceOn, toggleVoice, send, listen, stop, reset };
}
