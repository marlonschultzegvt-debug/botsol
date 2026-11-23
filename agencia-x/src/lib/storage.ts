/**
 * Armazenamento de arquivos do Portal (uploads do cliente).
 *
 *  - Produção: Supabase Storage (defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY;
 *    bucket privado "assets" ou SUPABASE_BUCKET). Downloads saem por URL assinada de 5 min.
 *  - Desenvolvimento: pasta local (.uploads/), servida pela rota autenticada /api/assets/[id].
 *
 * A chave de serviço do Supabase só existe no servidor.
 */
import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const SB_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET ?? "assets";
const LOCAL_DIR = path.resolve(process.env.LOCAL_UPLOAD_DIR ?? ".uploads");

export const storageMode = () => (SB_URL && SB_KEY ? "supabase" : "local") as "supabase" | "local";

/** Limite por arquivo. Na Vercel o corpo da requisição é limitado a ~4,5 MB. */
export const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB ?? (process.env.VERCEL ? 4 : 25));

export const ALLOWED_MIME = /^(image\/|video\/|audio\/|application\/pdf$)/;

const sbHeaders = () => ({ Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY! });

export async function putObject(key: string, data: Buffer, mimeType: string) {
  if (storageMode() === "supabase") {
    const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: { ...sbHeaders(), "Content-Type": mimeType, "x-upsert": "false" },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Supabase Storage respondeu ${res.status}: ${await res.text()}`);
    return;
  }
  const file = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

/** Supabase: URL assinada temporária. Local: devolve null (a rota serve o arquivo). */
export async function signedUrl(key: string, downloadName: string): Promise<string | null> {
  if (storageMode() !== "supabase") return null;
  const res = await fetch(`${SB_URL}/storage/v1/object/sign/${BUCKET}/${key}`, {
    method: "POST",
    headers: { ...sbHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  if (!res.ok) throw new Error(`Supabase Storage respondeu ${res.status}`);
  const { signedURL } = (await res.json()) as { signedURL: string };
  return `${SB_URL}/storage/v1${signedURL}&download=${encodeURIComponent(downloadName)}`;
}

export async function readLocal(key: string) {
  const file = path.join(LOCAL_DIR, key);
  if (!file.startsWith(LOCAL_DIR + path.sep)) throw new Error("Caminho inválido");
  return readFile(file);
}

export async function deleteObject(key: string) {
  if (storageMode() === "supabase") {
    await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${key}`, { method: "DELETE", headers: sbHeaders() });
    return;
  }
  await unlink(path.join(LOCAL_DIR, key)).catch(() => undefined);
}

/** Nome seguro: sem acentos, barras ou caracteres estranhos. */
export const safeName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-120) || "arquivo";
