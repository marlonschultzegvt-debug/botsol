import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AGENCY_NAME } from "@/lib/utils";

export const metadata: Metadata = {
  title: { default: AGENCY_NAME, template: `%s · ${AGENCY_NAME}` },
  description: "Sistema operacional da agência: conteúdo com IA, espião de concorrentes, CRM e calendário.",
};

export const viewport: Viewport = { themeColor: "#05080f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
