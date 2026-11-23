/**
 * Configuração "leve" do Auth.js, sem Prisma: roda no middleware (edge).
 * Regras de acesso:
 *  - sem sessão → /login
 *  - papel CLIENT → só /portal
 *  - logado tentando abrir /login ou /cadastro → /dashboard
 */
import type { NextAuthConfig } from "next-auth";

const PUBLIC = ["/login", "/cadastro"];

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // definidos em auth.ts (precisam do banco)
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;
      const isPublic = PUBLIC.some((p) => pathname.startsWith(p));

      if (!user) {
        // APIs respondem 401 em JSON (redirecionar um POST para a página de login não faz sentido).
        if (pathname.startsWith("/api/")) return Response.json({ error: "Faça login novamente." }, { status: 401 });
        return isPublic; // false = redireciona para /login
      }
      if (isPublic) return Response.redirect(new URL("/dashboard", request.nextUrl));
      if (user.role === "CLIENT" && !pathname.startsWith("/portal") && !pathname.startsWith("/api/"))
        return Response.redirect(new URL("/portal", request.nextUrl));
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.agencyId = user.agencyId;
        token.role = user.role;
        token.clientId = user.clientId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid!;
      session.user.agencyId = token.agencyId!;
      session.user.role = token.role!;
      session.user.clientId = token.clientId ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
