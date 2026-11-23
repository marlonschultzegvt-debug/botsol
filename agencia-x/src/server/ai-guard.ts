/**
 * Guarda das rotas de IA: exige login, permissão e créditos do mês.
 * Devolve o usuário ou uma Response de erro pronta.
 */
import "server-only";
import { can, getUser, type SessionUser } from "@/lib/session";
import { aiUsage } from "./queries";

export async function guardAi(): Promise<{ user: SessionUser } | { error: Response }> {
  const user = await getUser();
  if (!user) return { error: Response.json({ error: "Faça login novamente." }, { status: 401 }) };
  if (!can(user.role, "ai:use")) return { error: Response.json({ error: "Seu papel não usa a IA." }, { status: 403 }) };
  const { used, limit } = await aiUsage(user.agencyId);
  if (used >= limit)
    return { error: Response.json({ error: `Créditos de IA do mês esgotados (${used}/${limit}). Faça upgrade do plano.` }, { status: 402 }) };
  return { user };
}
