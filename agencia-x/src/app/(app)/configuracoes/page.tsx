import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Configurações" };

export default function Page() {
  return <ComingSoon title="Configurações" items={["Marca da agência: nome, logo e cores do tema", "Usuários e papéis: Admin, Gestor, Redator, Editor, Cliente", "Templates de prompt por nicho", "Integrações: Claude, Apify, Supabase"]} />;
}
