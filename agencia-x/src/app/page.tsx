import { redirect } from "next/navigation";

// Próxima etapa: landing page de vendas aqui; por enquanto vai direto ao app.
export default function Home() {
  redirect("/dashboard");
}
