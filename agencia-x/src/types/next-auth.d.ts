import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

/** Dados extras que guardamos na sessão: agência ativa e papel do usuário nela. */
declare module "next-auth" {
  interface User {
    agencyId?: string;
    role?: Role;
    clientId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      agencyId: string;
      role: Role;
      clientId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    agencyId?: string;
    role?: Role;
    clientId?: string | null;
  }
}
