import Link from "next/link";
import { Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PortalView } from "@/components/portal/portal-view";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { MAX_UPLOAD_MB } from "@/lib/storage";
import { getPortal } from "@/server/queries-ops";

export const metadata = { title: "Portal do cliente" };

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requireUser();
  const isClient = user.role === "CLIENT";
  // Cliente: sempre o próprio cadastro. Equipe: escolhe qual cliente pré-visualizar.
  const clientId = isClient ? user.clientId : (await searchParams).client;

  if (!clientId) {
    const clients = await db.client.findMany({
      where: { agencyId: user.agencyId, status: { not: "CHURN" } },
      select: { id: true, name: true, _count: { select: { contents: { where: { status: "IN_APPROVAL" } } } } },
      orderBy: { name: "asc" },
    });
    return (
      <div className="space-y-4">
        <div>
          <p className="hud-label">Pré-visualização</p>
          <h1 className="mt-1 text-2xl font-semibold">Portal do cliente</h1>
          <p className="text-sm text-muted-foreground">Veja o portal exatamente como o cliente vê. Para dar acesso, abra a ficha do cliente.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Link key={c.id} href={`/portal?client=${c.id}`}>
              <Card className="flex items-center gap-3 p-4 transition hover:border-primary/50">
                <Eye className="h-4 w-4 text-primary" />
                <span className="flex-1 truncate">{c.name}</span>
                {c._count.contents > 0 && <span className="font-mono text-xs text-warning">{c._count.contents} p/ aprovar</span>}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const data = await getPortal(user.agencyId, clientId);
  if (!data) return <Card className="p-8 text-center text-sm text-muted-foreground">Cliente não encontrado.</Card>;

  return <PortalView data={data} preview={!isClient} viewerName={firstName(user.name)} maxUploadMb={MAX_UPLOAD_MB} />;
}

/** "Dra. Paula Souza" → "Dra. Paula"; "Paula Souza" → "Paula". */
function firstName(name: string) {
  const [a, b] = name.trim().split(/\s+/);
  return a?.endsWith(".") && b ? `${a} ${b}` : a ?? name;
}
