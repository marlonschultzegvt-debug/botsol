/** Auth.js completo (servidor): login por e-mail + senha com bcrypt. */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";

const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          include: { memberships: { orderBy: { id: "asc" }, take: 1 } },
        });
        if (!user?.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        const m = user.memberships[0];
        if (!m) return null; // usuário sem agência
        return { id: user.id, name: user.name, email: user.email, agencyId: m.agencyId, role: m.role, clientId: m.clientId };
      },
    }),
  ],
});
