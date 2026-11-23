import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, hint, icon: Icon, trend,
}: { label: string; value: string; hint?: string; icon: LucideIcon; trend?: "up" | "down" }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="hud-label">{label}</p>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && (
        <p className={cn("mt-1 text-xs", trend === "up" ? "text-success" : trend === "down" ? "text-danger" : "text-muted-foreground")}>
          {hint}
        </p>
      )}
    </Card>
  );
}
