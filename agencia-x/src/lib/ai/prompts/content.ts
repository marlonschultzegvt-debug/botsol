/**
 * Prompts do Módulo de Conteúdo.
 * Cada tipo tem uma "receita" de saída. O builder junta: tipo + briefing + nicho.
 */
import { BASE_STRATEGIST } from "./base";
import { findNiche } from "./niches";

export const CONTENT_TYPES = {
  reels: {
    label: "Roteiro de Reels / TikTok / Shorts",
    recipe: `Para CADA roteiro entregue:
### Roteiro N — <título interno>
- **Gancho (0–3s):** fala exata + o que aparece na tela (texto na tela entre aspas)
- **Desenvolvimento:** cenas numeradas no formato \`[CENA] o que mostrar\` → **Fala:** "..."
- **Virada/Payoff:** o momento que entrega o valor
- **CTA final:** fala exata
- **Duração estimada:** em segundos (ideal 15–45s)
- **Dica de gravação:** enquadramento, ritmo de corte, áudio/trend sugerida
- **Legenda curta** (até 2 linhas) + 5 hashtags`,
  },
  legenda: {
    label: "Legenda + hashtags",
    recipe: `Para CADA legenda entregue:
### Legenda N — <abordagem: storytelling | lista | polêmica | educativa>
Primeira linha = gancho que funcione cortado no "...mais".
Corpo escaneável (parágrafos curtos, emojis com moderação).
CTA claro no final.
**Hashtags:** 3 amplas + 5 do nicho + 3 locais/específicas (total 8–12).`,
  },
  carrossel: {
    label: "Carrossel",
    recipe: `Para CADA carrossel entregue:
### Carrossel N — <título>
| Slide | Título (máx. 8 palavras) | Texto de apoio (máx. 25 palavras) | Sugestão visual |
Slide 1 = capa com gancho irresistível. Slides do meio = 1 ideia por slide, com progressão lógica.
Penúltimo = resumo/virada. Último = CTA (salvar/compartilhar/seguir).
Use 7 a 10 slides. Depois da tabela: **Legenda** do post + hashtags.`,
  },
  hooks: {
    label: "Hooks + CTAs",
    recipe: `Entregue:
## Ganchos
Lista numerada; agrupe por estilo (Curiosidade, Dor, Contraste, Número/Lista, Polêmica leve, POV/História).
Cada gancho: a frase + entre parênteses o texto curto para a tela.
## CTAs
10 CTAs variados (engajamento, salvamento, direct com palavra-chave, link, visita), indicando quando usar cada um.`,
  },
} as const;

export type ContentType = keyof typeof CONTENT_TYPES;

export type ContentBrief = {
  type: ContentType;
  topic: string;
  clientName?: string;
  nicheId?: string;
  nicheFree?: string;
  audience?: string;
  goal?: string;
  tone?: string;
  platform?: string;
  quantity?: number;
  extra?: string;
};

export const CONTENT_SYSTEM = `${BASE_STRATEGIST}

Você está no módulo "Estúdio de Conteúdo". Entregue exatamente o formato pedido, sem introduções do tipo "Claro! Aqui está".
Comece direto pelo primeiro item. Ao final, uma seção curta "💡 Por que isso funciona" com 2–3 bullets.`;

export function buildContentPrompt(b: ContentBrief): string {
  const t = CONTENT_TYPES[b.type];
  const niche = findNiche(b.nicheId);
  const qty = Math.min(Math.max(b.quantity ?? 3, 1), 10);
  const qtyLine = b.type === "hooks" ? `Quantidade de ganchos: ${qty * 5}` : `Quantidade: ${qty}`;

  return [
    `# Tarefa: ${t.label}`,
    qtyLine,
    `Tema/assunto: ${b.topic}`,
    b.clientName && `Cliente: ${b.clientName}`,
    (niche || b.nicheFree) && `Nicho: ${niche?.niche ?? b.nicheFree}`,
    niche && `Conhecimento do nicho: ${niche.instruction}`,
    b.audience && `Público-alvo: ${b.audience}`,
    b.goal && `Objetivo do conteúdo: ${b.goal}`,
    b.tone && `Tom de voz: ${b.tone}`,
    b.platform && `Plataforma principal: ${b.platform}`,
    b.extra && `Observações do briefing: ${b.extra}`,
    "",
    "## Formato de saída",
    t.recipe,
    qty > 1 && "Cada item deve ter um ângulo diferente (não repita a mesma estrutura de gancho).",
  ]
    .filter(Boolean)
    .join("\n");
}
