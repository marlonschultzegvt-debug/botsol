"use client";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSISTANT_NAME } from "@/lib/utils";

export function Header({ onMenu, onJarvis }: { onMenu: () => void; onJarvis: () => void }) {
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
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary to-violet-500 text-xs font-bold text-primary-foreground">
          MS
        </div>
      </div>
    </header>
  );
}
