"use server";
/** Server actions de login, cadastro e logout. */
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";

/** `values` devolve o que foi digitado: o React 19 limpa o form após a action. */
export type FormState = { error?: string; values?: Record<string, string> } | undefined;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  // Destino pelo papel (a senha ainda é conferida no signIn; aqui só escolhemos a página).
  const m = await db.membership.findFirst({ where: { user: { email } }, orderBy: { id: "asc" }, select: { role: true } });
  try {
    await signIn("credentials", {
      email,
      password: String(form.get("password") ?? ""),
      redirectTo: m?.role === "CLIENT" ? "/portal" : "/dashboard",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "E-mail ou senha incorretos.", values: { email: String(form.get("email") ?? "") } };
    throw e; // o redirect do Next é uma exceção e precisa subir
  }
}

const SignupSchema = z.object({
  agency: z.string().trim().min(2, "Nome da agência muito curto"),
  name: z.string().trim().min(2, "Informe seu nome"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa de 8+ caracteres"),
});

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Cadastro = cria a agência + o usuário Admin dela, e já faz login. */
export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(form));
  const values = { agency: String(form.get("agency") ?? ""), name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const { agency, name, email, password } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { error: "Este e-mail já tem conta. Faça login.", values };

  let slug = slugify(agency) || "agencia";
  if (await db.agency.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;

  await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      memberships: { create: { role: "ADMIN", agency: { create: { name: agency, slug } } } },
    },
  });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
