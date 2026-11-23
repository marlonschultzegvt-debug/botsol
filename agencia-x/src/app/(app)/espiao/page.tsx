import { apifyEnabled } from "@/lib/apify";
import { SpyTool } from "./spy-tool";

export const metadata = { title: "Espião" };
export const dynamic = "force-dynamic";

export default function SpyPage() {
  // O servidor informa se a coleta real (Apify) está ativa — o token nunca vai ao navegador.
  return <SpyTool liveData={apifyEnabled()} />;
}
