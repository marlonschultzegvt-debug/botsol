/**
 * GET /api/instagram/callback — a Meta volta para cá depois do login.
 * Troca o código pelo token de 60 dias, lê o perfil e salva a conta (token criptografado).
 */
import { db } from "@/lib/db";
import { encrypt, verifyState } from "@/lib/crypto";
import { exchangeCode, getProfile, igRedirectUri } from "@/lib/instagram";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = verifyState<{ a: string; c: string; u: string }>(url.searchParams.get("state"));
  const user = await getUser();
  const back = (clientId: string, status: string, extra?: string) => {
    const to = new URL(clientId ? `/clientes/${clientId}` : "/clientes", url);
    to.searchParams.set("ig", status);
    to.hash = "conta-instagram";
    if (extra) to.searchParams.set("igmsg", extra.slice(0, 200));
    return Response.redirect(to, 302);
  };

  // Sessão e state precisam bater: mesma agência e mesmo usuário que iniciou.
  if (!state || !user || user.agencyId !== state.a || user.id !== state.u) return back(state?.c ?? "", "expirou");
  if (url.searchParams.get("error")) return back(state.c, "cancelado");
  const code = url.searchParams.get("code");
  if (!code) return back(state.c, "erro", "A Meta não enviou o código de autorização.");

  try {
    const { token, expiresAt } = await exchangeCode(code, igRedirectUri(url.origin));
    const profile = await getProfile(token);
    if (profile.account_type && !/BUSINESS|MEDIA_CREATOR|CREATOR/i.test(profile.account_type)) {
      return back(state.c, "erro", "A conta precisa ser Profissional (Empresa ou Criador de conteúdo).");
    }
    const client = await db.client.findFirst({ where: { id: state.c, agencyId: state.a }, select: { id: true } });
    if (!client) return back("", "erro", "Cliente não encontrado.");

    const data = {
      igUserId: String(profile.user_id),
      username: profile.username,
      profilePictureUrl: profile.profile_picture_url ?? null,
      accessTokenEnc: encrypt(token),
      tokenExpiresAt: expiresAt,
      lastError: null,
    };
    await db.instagramAccount.upsert({
      where: { clientId: client.id },
      create: { ...data, agencyId: state.a, clientId: client.id },
      update: data,
    });
    // Mantém o @ do cadastro do cliente em dia.
    await db.client.update({ where: { id: client.id }, data: { instagram: `@${profile.username}` } });
    return back(client.id, "conectado");
  } catch (e) {
    console.error("[instagram callback]", e);
    return back(state.c, "erro", (e as Error).message);
  }
}
