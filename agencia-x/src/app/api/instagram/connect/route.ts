/**
 * GET /api/instagram/connect?client=ID — inicia o login do Instagram (Business Login).
 * Só Admin/Gestor. O "state" assinado leva agência, cliente e usuário (anti-CSRF).
 */
import { db } from "@/lib/db";
import { signState } from "@/lib/crypto";
import { authorizeUrl, igConfigured, igRedirectUri } from "@/lib/instagram";
import { can, getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await getUser();
  if (!user) return Response.redirect(new URL("/login", url), 302);
  const clientId = url.searchParams.get("client") ?? "";
  const back = new URL(`/clientes/${clientId}`, url);

  if (!can(user.role, "clients:write")) {
    back.searchParams.set("ig", "sem-permissao");
    return Response.redirect(back, 302);
  }
  if (!igConfigured()) {
    back.searchParams.set("ig", "nao-configurado");
    return Response.redirect(back, 302);
  }
  const client = await db.client.findFirst({ where: { id: clientId, agencyId: user.agencyId }, select: { id: true } });
  if (!client) return Response.redirect(new URL("/clientes", url), 302);

  const state = signState({ a: user.agencyId, c: client.id, u: user.id });
  return Response.redirect(authorizeUrl(state, igRedirectUri(url.origin)), 302);
}
