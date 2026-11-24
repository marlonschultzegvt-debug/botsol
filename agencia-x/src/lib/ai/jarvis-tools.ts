/**
 * Ferramentas do Jarvis (tool calling).
 * Regra de ouro: nenhuma ferramenta publica nada. Gerar cria prévia; agendar cria só uma
 * PROPOSTA que o usuário confirma com um toque na tela (aprovação humana).
 */
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { can, type SessionUser } from "@/lib/session";
import { createCarousel, findClientByName, SlideSchema, type MediaResult } from "@/server/media";
import { db } from "@/lib/db";
import { imageProviderConfigured, reelProviderConfigured } from "@/lib/media/providers";

export type JarvisEvent =
  | { t: "text"; d: string }
  | { t: "tool"; name: string; state: "start" | "done" | "error"; msg?: string }
  | { t: "media"; media: MediaResult }
  | { t: "confirm"; proposal: Proposal }
  | { t: "error"; msg: string }
  | { t: "done"; costUsd: number };

export type Proposal = {
  generationId: string;
  clientName: string;
  title: string;
  caption: string;
  scheduledAt: string; // "2026-11-25T18:00"
  mode: "cliente" | "aprovado";
  thumbs: string[]; // ids das artes para a prévia
};

export const JARVIS_TOOLS = [
  {
    name: "gerar_carrossel",
    description:
      "Gera as ARTES de um carrossel de Instagram (imagens JPG prontas, com a identidade visual do cliente) a partir dos slides que você escrever. Use sempre que pedirem carrossel/post em slides. Escreva textos curtos: título até 8 palavras, texto até 30. Slide 1 = gancho; último = CTA. Depois de gerar, mostre a prévia e pergunte se quer agendar.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["cliente", "slides", "legenda"],
      properties: {
        cliente: { type: "string", description: "Nome do cliente, exatamente como aparece nos DADOS DA AGÊNCIA." },
        slides: {
          type: "array", minItems: 2, maxItems: 10,
          items: {
            type: "object", additionalProperties: false, required: ["titulo", "texto"],
            properties: { titulo: { type: "string" }, texto: { type: "string" }, visual: { type: "string" } },
          },
        },
        legenda: { type: "string", description: "Legenda do post com CTA e hashtags no final." },
        estilo: { type: "string", enum: ["impacto", "clean", "dark"], description: "impacto = fundo na cor da marca; clean = fundo claro; dark = escuro." },
        formato: { type: "string", enum: ["feed", "quadrado", "story"], description: "feed 1080x1350 (padrão), quadrado 1080x1080, story 1080x1920." },
      },
    },
    eager_input_streaming: true,
  },
  {
    name: "agendar_post",
    description:
      "PROPÕE agendar uma mídia já gerada no calendário. NÃO publica nem agenda sozinho: aparece um cartão para o usuário confirmar. Use só depois que o usuário disser que quer agendar. modo 'cliente' = vai para aprovação do cliente no portal; 'aprovado' = o usuário já aprovou e pode ir ao ar no horário.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["geracao_id", "titulo", "data_hora", "legenda", "modo"],
      properties: {
        geracao_id: { type: "string", description: "O geracao_id registrado na conversa quando a mídia foi gerada." },
        titulo: { type: "string", description: "Título interno curto do conteúdo." },
        data_hora: { type: "string", description: "Data e hora no fuso de Brasília, formato AAAA-MM-DDTHH:MM." },
        legenda: { type: "string" },
        modo: { type: "string", enum: ["cliente", "aprovado"] },
      },
    },
    eager_input_streaming: true,
  },
  {
    name: "gerar_imagem",
    description: "Gera uma imagem única por IA (foto/ilustração) para o feed, quadrado ou story. Pode estar desativada: se a resposta disser que não está configurada, avise o usuário e ofereça um carrossel.",
    input_schema: {
      type: "object", additionalProperties: false, required: ["cliente", "prompt", "formato"],
      properties: {
        cliente: { type: "string" },
        prompt: { type: "string", description: "Descrição visual detalhada, em português." },
        formato: { type: "string", enum: ["feed", "quadrado", "story"] },
      },
    },
    eager_input_streaming: true,
  },
  {
    name: "gerar_reel",
    description: "Monta um Reel (vídeo 9:16 com narração, cenas e legendas) a partir de um roteiro. Pode estar desativada: se a resposta disser que não está configurada, entregue o roteiro em texto.",
    input_schema: {
      type: "object", additionalProperties: false, required: ["cliente", "cenas"],
      properties: {
        cliente: { type: "string" },
        cenas: {
          type: "array", minItems: 1, maxItems: 12,
          items: { type: "object", additionalProperties: false, required: ["fala", "visual"], properties: { fala: { type: "string" }, visual: { type: "string" } } },
        },
        voz: { type: "string", description: "Estilo de voz: feminina, masculina, jovem, séria..." },
      },
    },
    eager_input_streaming: true,
  },
] as unknown as Anthropic.Beta.BetaToolUnion[];

const CarouselIn = z.object({
  cliente: z.string().min(1),
  slides: z.array(SlideSchema).min(2).max(10),
  legenda: z.string().max(2200).default(""),
  estilo: z.enum(["impacto", "clean", "dark"]).optional(),
  formato: z.enum(["feed", "quadrado", "story"]).optional(),
});
const ScheduleIn = z.object({
  geracao_id: z.string().min(1),
  titulo: z.string().min(1).max(120),
  data_hora: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "data_hora no formato AAAA-MM-DDTHH:MM"),
  legenda: z.string().max(2200).default(""),
  modo: z.enum(["cliente", "aprovado"]),
});

/** Executa uma ferramenta. Devolve o texto para o modelo e emite eventos para a tela. */
export async function runJarvisTool(
  name: string,
  input: unknown,
  user: SessionUser,
  emit: (e: JarvisEvent) => void,
): Promise<{ content: string; isError?: boolean; costUsd?: number }> {
  if (!can(user.role, "content:write")) return { content: "O usuário atual não tem permissão para gerar mídia.", isError: true };

  switch (name) {
    case "gerar_carrossel": {
      const p = CarouselIn.safeParse(input);
      if (!p.success) return { content: `Entrada inválida: ${p.error.issues[0]?.message}. Corrija e chame de novo.`, isError: true };
      const client = await findClientByName(user.agencyId, p.data.cliente);
      if (!client) return { content: `Cliente "${p.data.cliente}" não encontrado. Use um nome da lista de clientes.`, isError: true };
      const media = await createCarousel({
        user, clientId: client.id, slides: p.data.slides, style: p.data.estilo, format: p.data.formato, caption: p.data.legenda, source: "jarvis",
      });
      emit({ t: "media", media });
      return {
        content: `Carrossel gerado com ${media.assets.length} artes para ${client.name}. geracao_id=${media.generationId}. A prévia já está na tela do usuário. Pergunte se ele aprova e quer agendar (e para quando).`,
        costUsd: media.costUsd,
      };
    }
    case "agendar_post": {
      const p = ScheduleIn.safeParse(input);
      if (!p.success) return { content: `Entrada inválida: ${p.error.issues[0]?.message}.`, isError: true };
      const gen = await db.aiGeneration.findFirst({
        where: { id: p.data.geracao_id, agencyId: user.agencyId },
        include: { client: { select: { name: true } } },
      });
      if (!gen || !gen.assetIds.length) return { content: "geracao_id não encontrado. Gere a mídia primeiro.", isError: true };
      emit({
        t: "confirm",
        proposal: {
          generationId: gen.id, clientName: gen.client?.name ?? "", title: p.data.titulo, caption: p.data.legenda,
          scheduledAt: p.data.data_hora.slice(0, 16), mode: p.data.modo, thumbs: gen.assetIds.slice(0, 3),
        },
      });
      return { content: "Proposta de agendamento exibida. NADA foi agendado ainda: o usuário precisa tocar em Confirmar no cartão. Diga isso a ele." };
    }
    case "gerar_imagem": {
      if (!imageProviderConfigured()) {
        return { content: "Geração de imagem por IA ainda não está ativada neste sistema (falta configurar o provedor). Avise o usuário e ofereça fazer um carrossel com a identidade visual do cliente, que já funciona." };
      }
      return { content: "Provedor de imagem configurado, mas a integração ainda não foi concluída.", isError: true };
    }
    case "gerar_reel": {
      if (!reelProviderConfigured()) {
        return { content: "Montagem de Reels ainda não está ativada (faltam os provedores de voz e vídeo). Entregue o roteiro completo em texto, cena a cena, e ofereça salvar no calendário." };
      }
      return { content: "Provedores de Reels configurados, mas a integração ainda não foi concluída.", isError: true };
    }
    default:
      return { content: `Ferramenta desconhecida: ${name}`, isError: true };
  }
}
