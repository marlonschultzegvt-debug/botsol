/**
 * Cliente central do Claude (Anthropic) — TODAS as funções de IA passam por aqui.
 *
 * Decisões:
 *  - Modelo padrão: claude-opus-5-5 (pode trocar com CLAUDE_MODEL).
 *  - Streaming para textos longos (roteiros, carrosséis, chat) -> sem timeout e
 *    o usuário vê o texto aparecer em tempo real.
 *  - `effort` define profundidade de raciocínio x custo por rota
 *    (chat = low, conteúdo = medium, análise de concorrente = high).
 *  - Fallback no servidor (`fallbacks: "default"`): se o modelo recusar um pedido
 *    por política, a API tenta automaticamente outro modelo na mesma chamada.
 *  - System prompt com cache_control: o prompt fixo é cacheado e fica mais barato
 *    nas chamadas seguintes.
 */
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic();
export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

type StreamArgs = {
  /** Parte fixa do system prompt (cacheada). */
  system: string;
  /** Parte que muda a cada chamada (ex.: dados vivos da agência) — fica depois do cache. */
  systemDynamic?: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort?: Effort;
  maxTokens?: number;
  /** Chamado ao fim com o texto completo e o uso de tokens (para salvar no histórico). */
  onFinish?: (r: { text: string; inputTokens: number; outputTokens: number; model: string }) => Promise<void> | void;
};

/** Erro "nosso" (recusa, resposta cortada): a mensagem já está em português. */
export class AiOutputError extends Error {}

/** Converte erros da API em mensagens claras em português. */
export function friendlyError(err: unknown): string {
  if (err instanceof AiOutputError) return err.message;
  if (err instanceof Anthropic.AuthenticationError)
    return "Chave da API do Claude inválida ou ausente. Configure ANTHROPIC_API_KEY no .env.";
  if (err instanceof Anthropic.RateLimitError)
    return "Limite de uso da API atingido. Aguarde alguns segundos e tente de novo.";
  if (err instanceof Anthropic.BadRequestError) return `Requisição inválida: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Erro da API do Claude (${err.status}): ${err.message}`;
  if (err instanceof Error && /api.?key|credential|authentication method/i.test(err.message))
    return "Credencial do Claude não encontrada. Configure ANTHROPIC_API_KEY no .env.";
  return "Erro inesperado ao falar com a IA.";
}

/**
 * Faz uma chamada em streaming e devolve um ReadableStream de texto puro,
 * pronto para ser retornado por uma Route Handler do Next.js.
 */
export function streamText({ system, systemDynamic, messages, effort = "medium", maxTokens = 32000, onFinish }: StreamArgs) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = anthropic.beta.messages.stream({
          model: MODEL,
          max_tokens: maxTokens,
          system: [
            { type: "text", text: system, cache_control: { type: "ephemeral" } },
            ...(systemDynamic ? [{ type: "text" as const, text: systemDynamic }] : []),
          ],
          messages,
          output_config: { effort },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }

        const final = await stream.finalMessage();
        const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        if (text && final.stop_reason !== "refusal") {
          await Promise.resolve(
            onFinish?.({ text, inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens, model: final.model }),
          ).catch((e) => console.error("[claude] onFinish", e));
        }
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n> ⚠️ A IA não pôde atender este pedido. Reformule o briefing."));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n> ⚠️ Resposta cortada por tamanho. Peça menos itens por vez."));
        }
      } catch (err) {
        console.error("[claude] stream error", err);
        controller.enqueue(encoder.encode(`\n\n> ❌ ${friendlyError(err)}`));
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Chamada que devolve JSON validado por um JSON Schema (structured outputs).
 * Usado pelo Espião para montar um relatório com campos fixos.
 */
export async function generateJson<T>({
  system,
  prompt,
  schema,
  effort = "high",
}: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: Effort;
}): Promise<{ data: T; inputTokens: number; outputTokens: number; model: string }> {
  // Streaming + finalMessage: análise longa sem risco de timeout HTTP.
  const stream = anthropic.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
    output_config: { effort, format: { type: "json_schema", schema } },
    betas: [FALLBACK_BETA],
    fallbacks: "default",
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") throw new AiOutputError("A IA recusou este pedido.");
  if (msg.stop_reason === "max_tokens") throw new AiOutputError("Relatório ficou grande demais; tente novamente.");

  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return {
    data: JSON.parse(text) as T,
    inputTokens: msg.usage.input_tokens,
    outputTokens: msg.usage.output_tokens,
    model: msg.model,
  };
}
