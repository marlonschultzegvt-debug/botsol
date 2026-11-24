/**
 * Custo estimado das gerações (registrado em AiGeneration.costUsd).
 * Preços por 1 milhão de tokens (US$), tabela oficial da Anthropic em nov/2026.
 * Serviços de mídia (imagem/voz/vídeo) somam o custo do provedor quando forem ativados.
 */
const CLAUDE_PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
  "claude-fable-5-2": { in: 8, out: 40 },
};

export function claudeCostUsd(model: string, inputTokens = 0, outputTokens = 0) {
  const key = Object.keys(CLAUDE_PRICES).find((k) => model.startsWith(k));
  const p = key ? CLAUDE_PRICES[key] : CLAUDE_PRICES["claude-opus-5-5"];
  return +((inputTokens * p.in + outputTokens * p.out) / 1_000_000).toFixed(4);
}

/** Cotação usada só para exibir em reais (aproximada). */
export const USD_BRL = Number(process.env.USD_BRL ?? 5.5);
export const brlFromUsd = (usd: number) =>
  (usd * USD_BRL).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
