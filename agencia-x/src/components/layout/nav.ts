import {
  LayoutDashboard, Users, Sparkles, Radar, CalendarDays, Megaphone, ListChecks,
  Layers, Globe2, Settings, Bot, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string };
export type NavGroup = { title: string; items: NavItem[] };

/** Navegação principal — a ordem reflete o fluxo de trabalho da agência. */
export const NAV: NavGroup[] = [
  {
    title: "Comando",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/jarvis", label: "Assistente", icon: Bot, badge: "IA" },
    ],
  },
  {
    title: "Criação",
    items: [
      { href: "/conteudo", label: "Estúdio de Conteúdo", icon: Sparkles, badge: "IA" },
      { href: "/espiao", label: "Espião", icon: Radar, badge: "IA" },
      { href: "/lote", label: "Geração em Lote", icon: Layers },
      { href: "/calendario", label: "Calendário", icon: CalendarDays },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/campanhas", label: "Campanhas & Serviços", icon: Megaphone },
      { href: "/tarefas", label: "Tarefas", icon: ListChecks },
      { href: "/portal", label: "Portal do Cliente", icon: Globe2 },
    ],
  },
  { title: "Sistema", items: [{ href: "/configuracoes", label: "Configurações", icon: Settings }] },
];
