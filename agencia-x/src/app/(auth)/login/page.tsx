"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction } from "@/server/auth-actions";

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Entrar</h1>
      <p className="mb-5 text-sm text-muted-foreground">Bem-vindo de volta, chefe.</p>
      <form action={action} key={JSON.stringify(state?.values ?? {})} className="space-y-4">
        <div><Label htmlFor="email">E-mail</Label><Input id="email" name="email" defaultValue={state?.values?.email} type="email" autoComplete="email" required /></div>
        <div><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <SubmitButton className="w-full">Entrar</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Não tem conta? <Link href="/cadastro" className="text-primary hover:underline">Criar agência</Link>
      </p>
    </Card>
  );
}
