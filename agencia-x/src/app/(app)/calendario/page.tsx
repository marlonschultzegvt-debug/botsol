import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Calendário Editorial" };

export default function Page() {
  return <ComingSoon title="Calendário Editorial" items={["Visão mês e semana com arrastar e soltar", "Filtro por cliente e formato", "Status: ideia → roteiro → filmado → editado → aprovação → publicado", "Lembretes de prazo e envio para aprovação do cliente"]} />;
}
