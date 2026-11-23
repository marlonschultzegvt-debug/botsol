"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renderiza a saída da IA (Markdown com tabelas). Estilos em globals.css (.prose-hud). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-hud">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
