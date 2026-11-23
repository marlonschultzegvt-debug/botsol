import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { clientOptions } from "@/server/queries";
import { ContentStudio, type HistoryItem } from "./studio";

export const metadata = { title: "Estúdio de Conteúdo" };

const DB_TO_TYPE = { REELS_SCRIPT: "reels", CAPTION: "legenda", CAROUSEL: "carrossel", HOOKS_CTAS: "hooks" } as const;

export default async function ContentPage() {
  const user = await requireUser();
  const [clients, gens] = await Promise.all([
    clientOptions(user.agencyId),
    db.aiGeneration.findMany({
      where: { agencyId: user.agencyId, type: { in: ["REELS_SCRIPT", "CAPTION", "CAROUSEL", "HOOKS_CTAS"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { client: { select: { name: true } } },
    }),
  ]);

  const history: HistoryItem[] = gens.map((g) => ({
    id: g.id,
    type: DB_TO_TYPE[g.type as keyof typeof DB_TO_TYPE],
    topic: String((g.input as { topic?: string })?.topic ?? ""),
    clientId: g.clientId,
    client: g.client?.name ?? null,
    output: g.output,
    at: g.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
  }));

  return <ContentStudio clients={clients} history={history} />;
}
