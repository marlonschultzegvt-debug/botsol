import { Construction } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Página provisória para módulos das próximas etapas. */
export function ComingSoon({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="hud-label">Em construção</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      </div>
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Construction className="h-6 w-6 shrink-0 text-warning" />
          <div>
            <p className="font-medium">Este módulo vem nas próximas etapas. Já está previsto:</p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              {items.map((i) => <li key={i}>▸ {i}</li>)}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
