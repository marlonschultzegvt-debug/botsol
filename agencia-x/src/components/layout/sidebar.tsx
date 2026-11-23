"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV } from "./nav";
import { cn } from "@/lib/utils";

/** Sidebar fixa no desktop; gaveta deslizante no mobile (controlada pelo Header). */
export function Sidebar({
  open, onClose, agencyName, credits,
}: { open: boolean; onClose: () => void; agencyName: string; credits: { used: number; limit: number } }) {
  const pct = credits.limit ? Math.min(100, Math.round((credits.used / credits.limit) * 100)) : 100;
  const pathname = usePathname();

  return (
    <>
      {/* overlay mobile */}
      <div
        onClick={onClose}
        className={cn("fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden", open ? "block" : "hidden")}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="relative grid h-8 w-8 place-items-center rounded-full border border-primary/60 shadow-glow">
              <span className="h-3 w-3 animate-core rounded-full bg-primary" />
            </span>
            <span className="truncate font-semibold tracking-wide">{agencyName}</span>
          </Link>
          <button className="text-muted-foreground lg:hidden" onClick={onClose} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.title}>
              <p className="hud-label mb-2 px-3">{group.title}</p>
              <ul className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon, badge }) => {
                  const active = pathname === href || pathname.startsWith(href + "/");
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary/10 text-primary shadow-[inset_2px_0_0_hsl(var(--primary))]"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{label}</span>
                        {badge && (
                          <span className="rounded border border-primary/40 px-1 font-mono text-[9px] text-primary">{badge}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="m-3 rounded-lg border border-border bg-muted/40 p-3">
          <p className="hud-label">Créditos de IA</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
            <div
              className={cn("h-full rounded-full shadow-glow", pct >= 90 ? "bg-danger" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {credits.used} de {credits.limit} usados este mês
          </p>
        </div>
      </aside>
    </>
  );
}
