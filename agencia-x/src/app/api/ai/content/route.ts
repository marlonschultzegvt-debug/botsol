/**
 * POST /api/ai/content — Estúdio de Conteúdo (streaming de texto).
 * Body: ContentBrief. Resposta: text/plain em stream. Header X-Generation-Id
 * não é possível (o id nasce no fim), então o front busca o histórico depois.
 */
import { z } from "zod";
import { streamText } from "@/lib/ai/claude";
import { buildContentPrompt, CONTENT_SYSTEM, CONTENT_TYPES, type ContentType } from "@/lib/ai/prompts/content";
import { db } from "@/lib/db";
import { guardAi } from "@/server/ai-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

const TYPE_TO_DB = { reels: "REELS_SCRIPT", legenda: "CAPTION", carrossel: "CAROUSEL", hooks: "HOOKS_CTAS" } as const;

const Brief = z.object({
  type: z.enum(Object.keys(CONTENT_TYPES) as [ContentType, ...ContentType[]]),
  topic: z.string().min(3, "Descreva o tema"),
  clientId: z.string().optional(),
  nicheId: z.string().optional(),
  audience: z.string().optional(),
  goal: z.string().optional(),
  tone: z.string().optional(),
  platform: z.string().optional(),
  quantity: z.number().int().min(1).max(10).optional(),
  extra: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const g = await guardAi();
  if ("error" in g) return g.error;
  const { user } = g;

  const parsed = Brief.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Briefing inválido" }, { status: 400 });
  }
  const brief = parsed.data;

  // Dados do cliente vêm do banco (tom de voz, público, nicho) — filtrados pela agência.
  const client = brief.clientId
    ? await db.client.findFirst({ where: { id: brief.clientId, agencyId: user.agencyId } })
    : null;

  const prompt = buildContentPrompt({
    ...brief,
    clientName: client?.name,
    nicheFree: client?.niche,
    audience: brief.audience || client?.targetAudience || undefined,
    tone: brief.tone || client?.brandVoice || undefined,
    extra: [brief.extra, client?.goals && `Objetivos do cliente: ${client.goals}`].filter(Boolean).join("\n") || undefined,
  });

  const stream = streamText({
    system: CONTENT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    effort: "medium",
    onFinish: async (r) => {
      await db.aiGeneration.create({
        data: {
          agencyId: user.agencyId, userId: user.id, clientId: client?.id, type: TYPE_TO_DB[brief.type],
          input: brief, output: r.text, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens,
        },
      });
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
