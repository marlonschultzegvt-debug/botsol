import { AppShell } from "@/components/layout/app-shell";

// Grupo (app) = área logada. Próxima etapa: proteger com middleware do NextAuth.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
