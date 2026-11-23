import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Raiz: manda cada papel para a sua área. (Futuro: landing page de vendas para visitantes.)
export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "CLIENT" ? "/portal" : "/dashboard");
}
