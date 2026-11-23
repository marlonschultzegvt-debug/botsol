/**
 * Helpers de sessão e permissão usados por páginas, server actions e APIs.
 * Toda consulta ao banco usa o agencyId vindo daqui (nunca do navegador).
 */
import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";

export type SessionUser = { id: string; name: string; email: string; agencyId: string; role: Role; clientId: string | null };

/** Para páginas: redireciona ao login se não houver sessão. */
export async function requireUser(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user?.agencyId) redirect("/login");
  return s.user;
}

/** Para APIs: devolve null em vez de redirecionar. */
export async function getUser(): Promise<SessionUser | null> {
  const s = await auth();
  return s?.user?.agencyId ? s.user : null;
}

/** Matriz de permissões por papel. */
const PERMS = {
  "clients:write": ["ADMIN", "MANAGER"],
  "finance:read": ["ADMIN", "MANAGER"],
  "finance:write": ["ADMIN", "MANAGER"],
  "content:write": ["ADMIN", "MANAGER", "WRITER", "EDITOR"],
  "ai:use": ["ADMIN", "MANAGER", "WRITER", "EDITOR"],
  "settings:write": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMS;

export const can = (role: Role, perm: Permission) => (PERMS[perm] as readonly Role[]).includes(role);

export function assertCan(user: SessionUser, perm: Permission) {
  if (!can(user.role, perm)) throw new Error("Você não tem permissão para esta ação.");
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin", MANAGER: "Gestor", WRITER: "Redator", EDITOR: "Editor", CLIENT: "Cliente",
};
