import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { requireUser } from "@/lib/session";
import { logoutAction } from "@/server/auth-actions";
import { aiUsage } from "@/server/queries";

/** Layout do Portal: simples, sem menu da agência. A equipe vê um atalho de volta. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { agencyName } = await aiUsage(user.agencyId);
  const isClient = user.role === "CLIENT";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          {!isClient && (
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          )}
          <span className="relative grid h-7 w-7 place-items-center rounded-full border border-primary/60 shadow-glow">
            <span className="h-2.5 w-2.5 animate-core rounded-full bg-primary" />
          </span>
          <span className="truncate font-semibold">{agencyName}</span>
          <span className="hud-label hidden sm:inline">Portal do cliente</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <form action={logoutAction}>
              <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /> Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
