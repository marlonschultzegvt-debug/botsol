import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ClientForm } from "@/components/clients/client-form";
import { can, requireUser } from "@/lib/session";
import { createClientAction } from "@/server/actions/clients";

export const metadata = { title: "Novo cliente" };

export default async function NewClientPage() {
  const user = await requireUser();
  if (!can(user.role, "clients:write")) redirect("/clientes");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <h1 className="text-2xl font-semibold">Novo cliente</h1>
      <Card className="p-5"><ClientForm action={createClientAction} submitLabel="Cadastrar cliente" /></Card>
    </div>
  );
}
