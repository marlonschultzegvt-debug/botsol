"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signupAction } from "@/server/auth-actions";

export default function SignupPage() {
  const [state, action] = useActionState(signupAction, undefined);
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Criar sua agência</h1>
      <p className="mb-5 text-sm text-muted-foreground">Você será o administrador. Convide a equipe depois.</p>
      <form action={action} key={JSON.stringify(state?.values ?? {})} className="space-y-4">
        <div><Label htmlFor="agency">Nome da agência</Label><Input id="agency" name="agency" defaultValue={state?.values?.agency} required /></div>
        <div><Label htmlFor="name">Seu nome</Label><Input id="name" name="name" defaultValue={state?.values?.name} autoComplete="name" required /></div>
        <div><Label htmlFor="email">E-mail</Label><Input id="email" name="email" defaultValue={state?.values?.email} type="email" autoComplete="email" required /></div>
        <div><Label htmlFor="password">Senha (8+ caracteres)</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <SubmitButton className="w-full">Criar conta</SubmitButton>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Já tem conta? <Link href="/login" className="text-primary hover:underline">Entrar</Link>
      </p>
    </Card>
  );
}
