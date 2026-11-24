/**
 * POST /api/media/carousel — gera as artes de um carrossel.
 * Body: { clientId, slides? | text? | topic?, style?, format?, count?, caption? }
 *  - slides: usa direto;  text/topic: o Claude escreve os slides antes (custo registrado).
 */
import { z } from "zod";
import { friendlyError } from "@/lib/ai/claude";
import { guardAi } from "@/server/ai-guard";
import { createCarousel, SlideSchema, slidesFromSource } from "@/server/media";
import type { Slide } from "@/lib/media/carousel";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z
  .object({
    clientId: z.string().min(1, "Escolha o cliente"),
    slides: z.array(SlideSchema).min(2).max(10).optional(),
    text: z.string().max(12000).optional(),
    topic: z.string().max(500).optional(),
    count: z.number().int().min(3).max(10).optional(),
    caption: z.string().max(2200).optional(),
    style: z.enum(["impacto", "clean", "dark"]).optional(),
    format: z.enum(["feed", "quadrado", "story"]).optional(),
  })
  .refine((b) => b.slides || b.text || b.topic, "Envie os slides, um texto ou um tema.");

export async function POST(req: Request) {
  const g = await guardAi();
  if ("error" in g) return g.error;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const b = parsed.data;

  try {
    let slides: Slide[] | undefined = b.slides;
    let caption = b.caption ?? "";
    let extraCostUsd = 0;
    if (!slides) {
      const s = await slidesFromSource({ agencyId: g.user.agencyId, clientId: b.clientId, topic: b.topic, text: b.text, count: b.count });
      slides = s.slides;
      caption = caption || s.caption;
      extraCostUsd = s.costUsd;
    }
    if (!slides) throw new Error("Não foi possível montar os slides.");
    const result = await createCarousel({
      user: g.user, clientId: b.clientId, slides, style: b.style, format: b.format, caption, extraCostUsd,
      source: b.slides ? "slides" : b.text ? "texto-do-estudio" : "tema",
    });
    return Response.json({ ...result, slides });
  } catch (e) {
    console.error("[media/carousel]", e);
    const msg = e instanceof z.ZodError ? e.issues[0]?.message : e instanceof Error && !("status" in e) ? e.message : friendlyError(e);
    return Response.json({ error: msg }, { status: 502 });
  }
}
