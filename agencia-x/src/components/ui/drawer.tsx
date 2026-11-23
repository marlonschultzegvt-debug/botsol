"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

/** Painel lateral (desktop) / tela cheia (celular). Fecha com Esc ou clicando fora. */
export function Drawer({
  open, onClose, title, children, footer,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label={title} className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-primary/30 bg-card shadow-glow sm:w-[480px]">
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="font-semibold">{title}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </>
  );
}
