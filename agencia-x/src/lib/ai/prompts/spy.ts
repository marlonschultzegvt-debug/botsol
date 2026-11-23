/**
 * Prompts + schema da Ferramenta Espião (Competitor Intelligence).
 * Saída em JSON estruturado (structured outputs) para a UI montar o relatório.
 */
import { BASE_STRATEGIST } from "./base";

export const SPY_SYSTEM = `${BASE_STRATEGIST}

Agora você atua como analista de inteligência competitiva. Sua função: estudar um perfil concorrente e devolver um relatório acionável para a agência.

Regras de honestidade (OBRIGATÓRIAS):
- Se receber DADOS COLETADOS (posts, curtidas, comentários), baseie métricas neles e calcule médias reais.
- Se NÃO houver dados coletados, deixe claro em "confianca" que é uma ESTIMATIVA baseada no nicho e no que foi informado; use faixas (ex: "1,5%–3%") e não invente números exatos de seguidores.
- Ideias de conteúdo devem ser ADAPTAÇÕES estratégicas (o que funciona + como fazer melhor), nunca cópia.`;

/** JSON Schema do relatório (todas as chaves obrigatórias, sem campos extras). */
export const SPY_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "resumo",
    "confianca",
    "perfil",
    "metricas",
    "mix_conteudo",
    "pilares",
    "formatos_vencedores",
    "ganchos_observados",
    "ideias_conteudo",
    "tendencias_nicho",
    "oportunidades",
    "plano_acao",
  ],
  properties: {
    resumo: { type: "string", description: "Resumo executivo em 2-3 frases" },
    confianca: {
      type: "object",
      additionalProperties: false,
      required: ["nivel", "explicacao"],
      properties: {
        nivel: { type: "string", enum: ["alta", "media", "baixa"] },
        explicacao: { type: "string" },
      },
    },
    perfil: {
      type: "object",
      additionalProperties: false,
      required: ["analise_bio", "posicionamento", "publico_aparente", "nota_bio"],
      properties: {
        analise_bio: { type: "string" },
        posicionamento: { type: "string" },
        publico_aparente: { type: "string" },
        nota_bio: { type: "integer", description: "0 a 10" },
      },
    },
    metricas: {
      type: "object",
      additionalProperties: false,
      required: ["frequencia_postagem", "engajamento_estimado", "melhor_horario", "leitura"],
      properties: {
        frequencia_postagem: { type: "string" },
        engajamento_estimado: { type: "string" },
        melhor_horario: { type: "string" },
        leitura: { type: "string" },
      },
    },
    mix_conteudo: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["formato", "percentual"],
        properties: { formato: { type: "string" }, percentual: { type: "integer" } },
      },
    },
    pilares: { type: "array", items: { type: "string" } },
    formatos_vencedores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["formato", "por_que_funciona"],
        properties: { formato: { type: "string" }, por_que_funciona: { type: "string" } },
      },
    },
    ganchos_observados: { type: "array", items: { type: "string" } },
    ideias_conteudo: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "formato", "gancho", "por_que"],
        properties: {
          titulo: { type: "string" },
          formato: { type: "string" },
          gancho: { type: "string" },
          por_que: { type: "string" },
        },
      },
    },
    tendencias_nicho: { type: "array", items: { type: "string" } },
    oportunidades: { type: "array", items: { type: "string" }, description: "Lacunas que o concorrente não explora" },
    plano_acao: { type: "array", items: { type: "string" }, description: "Próximos passos para o cliente da agência" },
  },
} as const;

export type SpyReport = {
  resumo: string;
  confianca: { nivel: "alta" | "media" | "baixa"; explicacao: string };
  perfil: { analise_bio: string; posicionamento: string; publico_aparente: string; nota_bio: number };
  metricas: { frequencia_postagem: string; engajamento_estimado: string; melhor_horario: string; leitura: string };
  mix_conteudo: { formato: string; percentual: number }[];
  pilares: string[];
  formatos_vencedores: { formato: string; por_que_funciona: string }[];
  ganchos_observados: string[];
  ideias_conteudo: { titulo: string; formato: string; gancho: string; por_que: string }[];
  tendencias_nicho: string[];
  oportunidades: string[];
  plano_acao: string[];
};

export function buildSpyPrompt(input: {
  handle: string;
  niche?: string;
  clientContext?: string;
  manualNotes?: string;
  scraped?: unknown;
}) {
  return [
    `# Analisar concorrente: @${input.handle.replace(/^@/, "")}`,
    input.niche && `Nicho: ${input.niche}`,
    input.clientContext && `Nosso cliente (para quem é a análise): ${input.clientContext}`,
    input.manualNotes && `Observações/legendas coladas pela equipe:\n${input.manualNotes}`,
    input.scraped
      ? `## DADOS COLETADOS (Instagram, via coletor)\n\`\`\`json\n${JSON.stringify(input.scraped, null, 1)}\n\`\`\``
      : "## Sem dados coletados — faça uma análise ESTIMADA e sinalize isso em `confianca`.",
    "",
    "Gere o relatório completo. Entregue de 8 a 10 ideias de conteúdo, 6 a 10 ganchos, e um plano de ação de 5 passos.",
  ]
    .filter(Boolean)
    .join("\n");
}
