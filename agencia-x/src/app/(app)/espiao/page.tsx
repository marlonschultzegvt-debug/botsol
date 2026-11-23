import { apifyEnabled } from "@/lib/apify";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { SpyReport } from "@/lib/ai/prompts/spy";
import type { ScrapedProfile } from "@/lib/apify";
import { clientOptions } from "@/server/queries";
import { SpyTool, type PastAnalysis } from "./spy-tool";

export const metadata = { title: "Espião" };
export const dynamic = "force-dynamic";

export default async function SpyPage() {
  const user = await requireUser();
  const [clients, snaps] = await Promise.all([
    clientOptions(user.agencyId),
    db.competitorSnapshot.findMany({
      where: { competitor: { agencyId: user.agencyId } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { competitor: { select: { handle: true, clientId: true, client: { select: { name: true } } } } },
    }),
  ]);

  const past: PastAnalysis[] = snaps.map((s) => ({
    id: s.id,
    handle: s.competitor.handle,
    clientId: s.competitor.clientId,
    client: s.competitor.client?.name ?? null,
    at: s.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    result: {
      report: s.report as unknown as SpyReport,
      profile: (s.rawData as unknown as ScrapedProfile) ?? null,
      dataSource: s.dataSource as "apify" | "manual" | "estimated",
    },
  }));

  // O servidor informa se a coleta real (Apify) está ativa — o token nunca vai ao navegador.
  return <SpyTool liveData={apifyEnabled()} clients={clients} past={past} />;
}
