import { CampaignsView } from "@/components/campaigns/campaigns-view";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/session";
import { getCampaigns, getFinance } from "@/server/queries-ops";

export const metadata = { title: "Campanhas & Serviços" };

export default async function CampaignsPage() {
  const user = await requireUser();
  const money = can(user.role, "finance:read");
  const [data, finance, clients] = await Promise.all([
    getCampaigns(user.agencyId),
    money ? getFinance(user.agencyId) : Promise.resolve(null),
    db.client.findMany({ where: { agencyId: user.agencyId, status: { not: "CHURN" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Sem permissão financeira: esconde preços de contratos e serviços.
  const safe = money
    ? data
    : { services: data.services.map((s) => ({ ...s, price: 0 })), contracts: data.contracts.map((k) => ({ ...k, price: 0 })) };

  return <CampaignsView data={safe} finance={finance} clients={clients} canManage={can(user.role, "clients:write")} />;
}
