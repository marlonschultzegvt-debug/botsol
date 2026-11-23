/**
 * POST /api/assets — upload de arquivo (multipart: file, clientId?, contentPieceId?).
 * Cliente (papel CLIENT) só envia para o próprio cadastro; a equipe envia para clientes da agência.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { ALLOWED_MIME, MAX_UPLOAD_MB, putObject, safeName } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Escolha um arquivo." }, { status: 400 });
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024)
    return Response.json({ error: `Arquivo maior que ${MAX_UPLOAD_MB} MB.` }, { status: 413 });
  if (!ALLOWED_MIME.test(file.type))
    return Response.json({ error: "Tipo não permitido. Envie imagem, vídeo, áudio ou PDF." }, { status: 415 });

  // Para quem é o arquivo?
  const clientId = user.role === "CLIENT" ? user.clientId : String(form?.get("clientId") ?? "");
  if (!clientId) return Response.json({ error: "Cliente não informado." }, { status: 400 });
  const client = await db.client.findFirst({ where: { id: clientId, agencyId: user.agencyId }, select: { id: true } });
  if (!client) return Response.json({ error: "Cliente inválido." }, { status: 403 });

  const contentPieceId = String(form?.get("contentPieceId") ?? "") || null;
  if (contentPieceId) {
    const piece = await db.contentPiece.findFirst({ where: { id: contentPieceId, clientId }, select: { id: true } });
    if (!piece) return Response.json({ error: "Conteúdo inválido." }, { status: 400 });
  }

  const key = `${user.agencyId}/${clientId}/${randomUUID()}-${safeName(file.name)}`;
  try {
    await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  } catch (e) {
    console.error("[assets] upload", e);
    return Response.json({ error: "Falha ao salvar o arquivo. Tente de novo." }, { status: 502 });
  }

  const asset = await db.asset.create({
    data: {
      clientId, contentPieceId, uploadedById: user.id, fileName: file.name.slice(0, 200),
      mimeType: file.type, sizeBytes: file.size, storageKey: key,
    },
  });
  return Response.json({ id: asset.id });
}
