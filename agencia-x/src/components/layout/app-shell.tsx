"use client";
import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header, type HeaderUser } from "./header";
import { JarvisPanel } from "@/components/jarvis/jarvis-panel";
import { JarvisProvider } from "@/components/jarvis/jarvis-context";

/**
 * Casca do app: Sidebar + Header + assistente.
 * O Jarvis mora aqui (JarvisProvider) para o modo mãos-livres ouvir em qualquer tela
 * e abrir o painel sozinho quando alguém diz "E aí, Jarvis".
 */
export function AppShell({
  children, user, agencyName, credits,
}: { children: React.ReactNode; user: HeaderUser; agencyName: string; credits: { used: number; limit: number } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jarvisOpen, setJarvisOpen] = useState(false);
  const pathname = usePathname();

  // Na página /jarvis o chat já está na tela; nas outras, abre o painel.
  const onWake = useCallback(() => {
    if (pathname !== "/jarvis") setJarvisOpen(true);
  }, [pathname]);

  return (
    <JarvisProvider onWake={onWake}>
      <div className="min-h-screen">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} agencyName={agencyName} credits={credits} />
        <div className="lg:pl-64">
          <Header user={user} onMenu={() => setMenuOpen(true)} onJarvis={() => setJarvisOpen((v) => !v)} />
          <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
        <JarvisPanel open={jarvisOpen} onOpenChange={setJarvisOpen} />
      </div>
    </JarvisProvider>
  );
}
