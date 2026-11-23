import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Tarefas" };

export default function Page() {
  return <ComingSoon title="Tarefas" items={["Kanban: a fazer, fazendo, revisão, feito", "Responsável, prioridade e prazo", "Tarefas criadas automaticamente a partir do calendário"]} />;
}
