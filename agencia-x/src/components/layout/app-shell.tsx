"use client";
import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header, type HeaderUser } from "./header";
import { JarvisPanel } from "@/components/jarvis/jarvis-panel";

/** Casca do app: Sidebar + Header + painel flutuante do assistente. */
export function AppShell({
  children, user, agencyName, credits,
}: { children: React.ReactNode; user: HeaderUser; agencyName: string; credits: { used: number; limit: number } }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [jarvisOpen, setJarvisOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} agencyName={agencyName} credits={credits} />
      <div className="lg:pl-64">
        <Header user={user} onMenu={() => setMenuOpen(true)} onJarvis={() => setJarvisOpen((v) => !v)} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <JarvisPanel open={jarvisOpen} onOpenChange={setJarvisOpen} />
    </div>
  );
}
