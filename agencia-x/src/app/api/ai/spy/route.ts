/**
 * POST /api/ai/spy — Ferramenta Espião.
 * 1) Se houver APIFY_TOKEN, coleta dados públicos reais do perfil.
 * 2) Claude analisa e devolve relatório JSON estruturado (SPY_REPORT_SCHEMA).
 */
import { z } from "zod";
import { friendlyError, generateJson } from "@/lib/ai/claude";
import { buildSpyPrompt, SPY_REPORT_SCHEMA, SPY_SYSTEM, type SpyReport } from "@/lib/ai/prompts/spy";
import { apifyEnabled, scrapeInstagramProfile, type ScrapedProfile } from "@/lib/apify";

export const runtime = "nodejs";
export const maxDuration = 300;

const Input = z.object({
  handle: z.string().min(2, "Informe o @ do concorrente").regex(/^@?[\w.]+$/, "@ inválido"),
  niche: z.string().optional(),
  clientContext: z.string().optional(),
  manualNotes: z.string().max(12000).optional(),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const input = parsed.data;

  let scraped: ScrapedProfile | null = null;
  let scrapeWarning: string | undefined;
  if (apifyEnabled()) {
    try {
      scraped = await scrapeInstagramProfile(input.handle);
      if (!scraped) scrapeWarning = "Perfil não encontrado pelo coletor (privado ou inexistente).";
    } catch (e) {
      scrapeWarning = `Coleta falhou: ${(e as Error).message}. Seguindo com análise estimada.`;
    }
  }

  try {
    const report = await generateJson<SpyReport>({
      system: SPY_SYSTEM,
      prompt: buildSpyPrompt({ ...input, scraped }),
      schema: SPY_REPORT_SCHEMA as unknown as Record<string, unknown>,
      effort: "high",
    });
    return Response.json({
      report,
      profile: scraped,
      dataSource: scraped ? "apify" : input.manualNotes ? "manual" : "estimated",
      warning: scrapeWarning,
    });
  } catch (e) {
    console.error("[spy]", e);
    return Response.json({ error: e instanceof Error && !("status" in e) ? e.message : friendlyError(e) }, { status: 502 });
  }
}
