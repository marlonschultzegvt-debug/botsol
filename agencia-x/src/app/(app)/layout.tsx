import { AppShell } from "@/components/layout/app-shell";
import { requireUser, ROLE_LABEL } from "@/lib/session";
import { aiUsage } from "@/server/queries";

// Grupo (app) = área logada da agência (o middleware já barra quem não tem sessão).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const usage = await aiUsage(user.agencyId);
  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: ROLE_LABEL[user.role] }}
      agencyName={usage.agencyName}
      credits={{ used: usage.used, limit: usage.limit }}
    >
      {children}
    </AppShell>
  );
}
