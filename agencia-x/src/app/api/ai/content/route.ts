/**
 * POST /api/ai/content — Estúdio de Conteúdo (streaming de texto).
 * Body: ContentBrief (tipo, tema, nicho, tom...). Resposta: text/plain em stream.
 */
import { z } from "zod";
import { streamText } from "@/lib/ai/claude";
import { buildContentPrompt, CONTENT_SYSTEM, CONTENT_TYPES, type ContentType } from "@/lib/ai/prompts/content";

export const runtime = "nodejs";
export const maxDuration = 300;

const Brief = z.object({
  type: z.enum(Object.keys(CONTENT_TYPES) as [ContentType, ...ContentType[]]),
  topic: z.string().min(3, "Descreva o tema"),
  clientName: z.string().optional(),
  nicheId: z.string().optional(),
  nicheFree: z.string().optional(),
  audience: z.string().optional(),
  goal: z.string().optional(),
  tone: z.string().optional(),
  platform: z.string().optional(),
  quantity: z.number().int().min(1).max(10).optional(),
  extra: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const parsed = Brief.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Briefing inválido" }, { status: 400 });
  }

  // TODO (próxima etapa): checar sessão + créditos da agência e salvar em AiGeneration.
  const stream = streamText({
    system: CONTENT_SYSTEM,
    messages: [{ role: "user", content: buildContentPrompt(parsed.data) }],
    effort: "medium",
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
