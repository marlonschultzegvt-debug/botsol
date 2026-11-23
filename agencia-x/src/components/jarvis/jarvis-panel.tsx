"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ear, Maximize2, X } from "lucide-react";
import { JarvisChat } from "./jarvis-chat";
import { useJarvisCtx } from "./jarvis-context";
import { JarvisOrb } from "./jarvis-orb";
import { cn } from "@/lib/utils";

/** Botão flutuante + painel lateral do assistente, disponível em todas as telas. */
export function JarvisPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const j = useJarvisCtx();
  // Na página /jarvis o chat já ocupa a tela.
  if (usePathname() === "/jarvis") return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          className="fixed bottom-5 right-5 z-40 rounded-full transition hover:scale-105"
          aria-label={j.handsFree ? "Abrir assistente (mãos-livres ligado)" : "Abrir assistente"}
        >
          <JarvisOrb size={64} state={j.armed ? "listening" : j.state} />
          {j.handsFree && (
            <span className="absolute -left-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-primary/60 bg-background text-primary">
              <Ear className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      )}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-primary/30 bg-card/95 shadow-glow backdrop-blur-xl transition-transform sm:w-[420px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-end gap-1 p-2">
          <Link href="/jarvis" onClick={() => onOpenChange(false)} className="rounded p-2 text-muted-foreground hover:text-foreground" title="Tela cheia">
            <Maximize2 className="h-4 w-4" />
          </Link>
          <button onClick={() => onOpenChange(false)} className="rounded p-2 text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">{open && <JarvisChat />}</div>
      </div>
    </>
  );
}
