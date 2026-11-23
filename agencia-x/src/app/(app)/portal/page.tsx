import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Portal do Cliente" };

export default function Page() {
  return <ComingSoon title="Portal do Cliente" items={["Login próprio do cliente (papel CLIENT)", "Aprovar ou pedir ajustes em conteúdos", "Ver calendário e relatórios", "Upload de materiais (fotos, vídeos brutos)"]} />;
}
