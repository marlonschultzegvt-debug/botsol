"use client";
/**
 * Um único Jarvis para o app inteiro: a conversa continua igual no painel
 * flutuante e na tela cheia, e o modo mãos-livres escuta em qualquer página.
 */
import { createContext, useContext } from "react";
import { useJarvis, type JarvisApi } from "./use-jarvis";

const JarvisContext = createContext<JarvisApi | null>(null);

export function JarvisProvider({ children, onWake }: { children: React.ReactNode; onWake?: () => void }) {
  const api = useJarvis({ onWake });
  return <JarvisContext.Provider value={api}>{children}</JarvisContext.Provider>;
}

export function useJarvisCtx() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvisCtx precisa estar dentro de <JarvisProvider>");
  return ctx;
}
