"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/server/auth-actions";
import { ASSISTANT_NAME } from "@/lib/utils";

export type HeaderUser = { name: string; email: string; role: string };

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export function Header({ user, onMenu, onJarvis }: { user: HeaderUser; onMenu: () => void; onJarvis: () => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha o menu do usuário ao clicar fora.
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Abrir menu">
        <Menu />
      </Button>

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Buscar clientes, conteúdos, tarefas..."
          className="h-9 w-full rounded-md border border-input bg-muted/40 pl-9 pr-14 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onJarvis} className="border-primary/40 text-primary">
          <span className="h-2 w-2 animate-core rounded-full bg-primary" />
          {ASSISTANT_NAME}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notificações" className="relative">
          <Bell />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
        </Button>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label="Menu do usuário"
            className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-xs font-bold text-primary-foreground"
          >
            {initials(user.name)}
          </button>
          {menu && (
            <div className="hud-card absolute right-0 top-11 w-60 rounded-lg border border-border p-2 shadow-glow">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <p className="hud-label mt-1">{user.role}</p>
              </div>
              <form action={logoutAction}>
                <button className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
