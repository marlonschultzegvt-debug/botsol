/**
 * Criptografia simétrica (AES-256-GCM) para guardar tokens de terceiros no banco,
 * e assinatura HMAC para o "state" do login OAuth.
 * A chave é derivada do AUTH_SECRET (não precisa de outra variável de ambiente).
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET não configurado.");
  return s;
};
const key = (purpose: string) => createHash("sha256").update(`${secret()}:${purpose}`).digest();

/** Criptografa texto → "iv.tag.dados" em base64url. */
export function encrypt(plain: string, purpose = "tokens"): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(purpose), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string, purpose = "tokens"): string {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(purpose), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Assina um objeto (para o parâmetro state do OAuth). Expira em `ttlMs`. */
export function signState(obj: Record<string, string>, ttlMs = 15 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ ...obj, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", key("oauth-state")).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState<T extends Record<string, string>>(state: string | null): T | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key("oauth-state")).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const obj = JSON.parse(Buffer.from(body, "base64url").toString()) as T & { exp: number };
  return obj.exp > Date.now() ? obj : null;
}
