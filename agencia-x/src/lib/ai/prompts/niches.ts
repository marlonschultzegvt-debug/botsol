/**
 * Templates prontos por nicho ("prompt templates").
 * Cada template injeta conhecimento do nicho no prompt.
 * No banco: tabela PromptTemplate (estes são os templates globais do sistema).
 */
export type NicheTemplate = {
  id: string;
  niche: string;
  emoji: string;
  instruction: string;
};

export const NICHE_TEMPLATES: NicheTemplate[] = [
  {
    id: "odonto",
    niche: "Odontologia / Estética dental",
    emoji: "🦷",
    instruction:
      "Público teme dor e preço. Explore antes/depois (sem prometer resultado), mitos x verdades, bastidores do consultório e explicações simples. Respeite o código de ética do CFO: sem preço em anúncio e sem garantia de resultado.",
  },
  {
    id: "fitness",
    niche: "Fitness / Personal trainer",
    emoji: "💪",
    instruction:
      "Ganchos de erro comum ('você treina errado se...'), treinos rápidos demonstráveis, transformação de alunos com consentimento e rotina real. Evite promessas de emagrecimento em prazo fixo.",
  },
  {
    id: "moda",
    niche: "Moda / Loja de roupas",
    emoji: "👗",
    instruction:
      "Formatos de provador, 'como combinar 1 peça de 3 jeitos', tendências da estação, looks por ocasião e prova social de clientes. CTA para direct/WhatsApp ou link da loja.",
  },
  {
    id: "imob",
    niche: "Imobiliária / Corretor",
    emoji: "🏠",
    instruction:
      "Tours em POV, 'quanto custa morar em...', erros ao comprar imóvel, financiamento explicado simples. Gere autoridade local (bairros, valorização) sem prometer retorno financeiro.",
  },
  {
    id: "gastro",
    niche: "Restaurante / Food",
    emoji: "🍔",
    instruction:
      "Close de comida (ASMR visual), bastidores da cozinha, prato do dia, reação de clientes, promoções com urgência real. Ganchos sensoriais.",
  },
  {
    id: "infoprod",
    niche: "Infoprodutor / Mentoria",
    emoji: "🎓",
    instruction:
      "Conteúdo de autoridade (método em passos), quebra de crenças, storytelling de jornada e prova (sem números inventados). CTA de palavra-chave nos comentários para automação de direct.",
  },
  {
    id: "solar",
    niche: "Energia solar",
    emoji: "☀️",
    instruction:
      "Economia na conta de luz explicada com exemplos ilustrativos (deixe claro que é simulação), mitos (dia nublado, manutenção), bastidores de instalação, Lei 14.300 em linguagem simples. CTA para simulação gratuita.",
  },
  {
    id: "local",
    niche: "Negócio local (genérico)",
    emoji: "📍",
    instruction:
      "Rosto do dono, bastidores, perguntas frequentes respondidas em vídeo, depoimentos, conexão com a cidade/bairro. CTA para visita, WhatsApp ou rota no Maps.",
  },
];

export const findNiche = (id?: string) => NICHE_TEMPLATES.find((n) => n.id === id);
