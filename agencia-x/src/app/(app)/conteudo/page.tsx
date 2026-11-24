import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { clientOptions } from "@/server/queries";
import { ContentStudio, type HistoryItem } from "./studio";
import type { GalleryItem } from "@/components/media/art-panel";

export const metadata = { title: "Estúdio de Conteúdo" };

const DB_TO_TYPE = { REELS_SCRIPT: "reels", CAPTION: "legenda", CAROUSEL: "carrossel", HOOKS_CTAS: "hooks" } as const;

export default async function ContentPage() {
  const user = await requireUser();
  const [clients, gens, arts] = await Promise.all([
    clientOptions(user.agencyId),
    db.aiGeneration.findMany({
      where: { agencyId: user.agencyId, type: { in: ["REELS_SCRIPT", "CAPTION", "CAROUSEL", "HOOKS_CTAS"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { client: { select: { name: true } } },
    }),
    db.aiGeneration.findMany({
      where: { agencyId: user.agencyId, type: "CAROUSEL_ART" },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { client: { select: { name: true } }, contents: { select: { id: true }, take: 1 } },
    }),
  ]);
  const assetRows = await db.asset.findMany({
    where: { id: { in: arts.flatMap((a) => a.assetIds) }, client: { agencyId: user.agencyId } },
    select: { id: true, fileName: true },
  });
  const byId = new Map(assetRows.map((a) => [a.id, a]));
  const gallery: GalleryItem[] = arts.map((g) => ({
    id: g.id,
    clientName: g.client?.name ?? "",
    at: g.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }),
    assets: g.assetIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    caption: g.output,
    scheduled: g.contents.length > 0,
    costUsd: Number(g.costUsd ?? 0),
  }));

  const history: HistoryItem[] = gens.map((g) => ({
    id: g.id,
    type: DB_TO_TYPE[g.type as keyof typeof DB_TO_TYPE],
    topic: String((g.input as { topic?: string })?.topic ?? ""),
    clientId: g.clientId,
    client: g.client?.name ?? null,
    output: g.output,
    at: g.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }),
  }));

  return <ContentStudio clients={clients} history={history} gallery={gallery} />;
}
