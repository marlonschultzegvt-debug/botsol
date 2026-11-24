/**
 * POST /api/ai/spy — Ferramenta Espião.
 * 1) Se houver APIFY_TOKEN, coleta dados públicos reais do perfil.
 * 2) Claude devolve relatório JSON (SPY_REPORT_SCHEMA).
 * 3) Salva Competitor + CompetitorSnapshot (histórico) + AiGeneration (créditos).
 */
import { claudeCostUsd } from "@/lib/ai/pricing";
import { z } from "zod";
import { friendlyError, generateJson } from "@/lib/ai/claude";
import { buildSpyPrompt, SPY_REPORT_SCHEMA, SPY_SYSTEM, type SpyReport } from "@/lib/ai/prompts/spy";
import { apifyEnabled, scrapeInstagramProfile, type ScrapedProfile } from "@/lib/apify";
import { db } from "@/lib/db";
import { guardAi } from "@/server/ai-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

const Input = z.object({
  handle: z.string().min(2, "Informe o @ do concorrente").regex(/^@?[\w.]+$/, "@ inválido"),
  niche: z.string().optional(),
  clientId: z.string().optional(),
  manualNotes: z.string().max(12000).optional(),
});

export async function POST(req: Request) {
  const g = await guardAi();
  if ("error" in g) return g.error;
  const { user } = g;

  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const input = parsed.data;
  const handle = input.handle.replace(/^@/, "").toLowerCase();
  const client = input.clientId ? await db.client.findFirst({ where: { id: input.clientId, agencyId: user.agencyId } }) : null;

  let scraped: ScrapedProfile | null = null;
  let scrapeWarning: string | undefined;
  if (apifyEnabled()) {
    try {
      scraped = await scrapeInstagramProfile(handle);
      if (!scraped) scrapeWarning = "Perfil não encontrado pelo coletor (privado ou inexistente).";
    } catch (e) {
      scrapeWarning = `Coleta falhou: ${(e as Error).message}. Seguindo com análise estimada.`;
    }
  }
  const dataSource = scraped ? "apify" : input.manualNotes ? "manual" : "estimated";
  const niche = input.niche || client?.niche;

  try {
    const r = await generateJson<SpyReport>({
      system: SPY_SYSTEM,
      prompt: buildSpyPrompt({
        handle, niche, manualNotes: input.manualNotes, scraped,
        clientContext: client ? `${client.name} (${client.niche}, ${client.instagram ?? ""}). Objetivos: ${client.goals ?? "-"}` : undefined,
      }),
      schema: SPY_REPORT_SCHEMA as unknown as Record<string, unknown>,
      effort: "high",
    });

    // Histórico: concorrente + snapshot (permite comparar evolução depois).
    const competitor = await db.competitor.upsert({
      where: { agencyId_handle_platform: { agencyId: user.agencyId, handle, platform: "INSTAGRAM" } },
      create: { agencyId: user.agencyId, handle, clientId: client?.id, niche },
      update: { clientId: client?.id ?? undefined, niche: niche ?? undefined },
    });
    await db.competitorSnapshot.create({
      data: {
        competitorId: competitor.id, dataSource, report: r.data, rawData: scraped ?? undefined,
        followers: scraped?.followers, postsCount: scraped?.postsCount, avgLikes: scraped?.avgLikes,
        avgComments: scraped?.avgComments, engagementRate: scraped?.engagementRatePct, postsPerWeek: scraped?.postsPerWeek,
      },
    });
    await db.aiGeneration.create({
      data: {
        agencyId: user.agencyId, userId: user.id, clientId: client?.id, type: "COMPETITOR_REPORT",
        input: { ...input, handle }, output: JSON.stringify(r.data), model: r.model,
        inputTokens: r.inputTokens, outputTokens: r.outputTokens,
        provider: "claude", costUsd: claudeCostUsd(r.model, r.inputTokens, r.outputTokens),
      },
    });

    return Response.json({ report: r.data, profile: scraped, dataSource, warning: scrapeWarning });
  } catch (e) {
    console.error("[spy]", e);
    return Response.json({ error: friendlyError(e) }, { status: 502 });
  }
}
