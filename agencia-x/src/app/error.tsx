"use client";
/**
 * Tela de erro amigável (substitui o "Application error" branco do Next.js).
 * Caso mais comum: a página ficou aberta durante uma nova publicação e o
 * formulário antigo não é mais reconhecido. Recarregar resolve.
 */
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const stale = /Server Action|deployment|Failed to fetch|ChunkLoadError|Loading chunk/i.test(error.message);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="hud-card w-full max-w-sm rounded-lg border border-border p-6 text-center">
        <p className="hud-label">Ops</p>
        <h1 className="mt-2 text-lg font-semibold">{stale ? "O sistema foi atualizado" : "Algo deu errado"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stale
            ? "Esta página estava aberta de uma versão anterior. Recarregue e tente de novo."
            : "Tente de novo. Se continuar, avise o suporte com o código abaixo."}
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground">código: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-glow"
          >
            Recarregar
          </button>
          {!stale && (
            <button onClick={reset} className="h-9 rounded-md border border-border px-4 text-sm">
              Tentar de novo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
