import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Clientes" };

export default function Page() {
  return <ComingSoon title="Clientes" items={["Lista com filtros por status (ativo, pausado, churn) e nicho", "Ficha do cliente: objetivos, tom de voz, ticket médio, Instagram", "Histórico de interações e notas (ligação, reunião, WhatsApp)", "Concorrentes vinculados ao cliente (Espião)"]} />;
}
