import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Campanhas & Serviços" };

export default function Page() {
  return <ComingSoon title="Campanhas & Serviços" items={["Catálogo de pacotes (Gestão de Instagram, Tráfego Pago, Conteúdo)", "Contratos por cliente com entregas e prazos", "Financeiro: faturas pagas, pendentes e atrasadas"]} />;
}
