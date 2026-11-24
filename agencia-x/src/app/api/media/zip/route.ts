/**
 * GET /api/media/zip?g=<generationId> — baixa todas as artes de uma geração em um ZIP.
 */
import { zipSync } from "fflate";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getObjectBytes } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
  if (user.role === "CLIENT") return Response.json({ error: "Sem permissão." }, { status: 403 });

  const id = new URL(req.url).searchParams.get("g") ?? "";
  const gen = await db.aiGeneration.findFirst({ where: { id, agencyId: user.agencyId }, include: { client: { select: { name: true } } } });
  if (!gen || !gen.assetIds.length) return Response.json({ error: "Geração não encontrada." }, { status: 404 });

  const assets = await db.asset.findMany({ where: { id: { in: gen.assetIds }, client: { agencyId: user.agencyId } } });
  const order = new Map(gen.assetIds.map((a, i) => [a, i]));
  assets.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const files: Record<string, Uint8Array> = {};
  for (const a of assets) files[a.fileName] = new Uint8Array(await getObjectBytes(a.storageKey));
  if (gen.output) files["legenda.txt"] = new TextEncoder().encode(gen.output);

  const zip = zipSync(files, { level: 0 }); // JPEG já é comprimido
  const slug = (gen.client?.name ?? "carrossel").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").toLowerCase();
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-${gen.id.slice(-6)}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
