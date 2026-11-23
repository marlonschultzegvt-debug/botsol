/**
 * GET    /api/assets/[id] — baixa o arquivo (checa agência e, para cliente, o próprio cadastro).
 * DELETE /api/assets/[id] — apaga (quem enviou ou Admin/Gestor).
 */
import { db } from "@/lib/db";
import { can, getUser, type SessionUser } from "@/lib/session";
import { deleteObject, readLocal, signedUrl } from "@/lib/storage";

export const runtime = "nodejs";

async function findAsset(user: SessionUser, id: string) {
  return db.asset.findFirst({
    where: {
      id,
      client: { agencyId: user.agencyId },
      ...(user.role === "CLIENT" ? { clientId: user.clientId ?? "-" } : {}),
    },
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
  const asset = await findAsset(user, (await params).id);
  if (!asset) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });

  const url = await signedUrl(asset.storageKey, asset.fileName);
  if (url) return Response.redirect(url, 302);

  const data = await readLocal(asset.storageKey).catch(() => null);
  if (!data) return Response.json({ error: "Arquivo indisponível." }, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
  const asset = await findAsset(user, (await params).id);
  if (!asset) return Response.json({ error: "Arquivo não encontrado." }, { status: 404 });
  if (asset.uploadedById !== user.id && !can(user.role, "clients:write"))
    return Response.json({ error: "Sem permissão para apagar." }, { status: 403 });

  await deleteObject(asset.storageKey);
  await db.asset.delete({ where: { id: asset.id } });
  return Response.json({ ok: true });
}
