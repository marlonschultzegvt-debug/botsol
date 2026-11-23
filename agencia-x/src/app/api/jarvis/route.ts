/**
 * POST /api/jarvis — chat com o assistente (streaming).
 * Body: { messages: [{ role: "user"|"assistant", content: string }] }
 */
import { z } from "zod";
import { streamText } from "@/lib/ai/claude";
import { buildJarvisSystem } from "@/lib/ai/prompts/jarvis";
import { agencySnapshotForAI } from "@/lib/mock-data";
import { AGENCY_NAME, ASSISTANT_NAME } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20000) }))
    .min(1)
    .max(60),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagens inválidas" }, { status: 400 });

  const msgs = parsed.data.messages;
  if (msgs[0].role !== "user") msgs.shift(); // a API exige começar com o usuário

  // System = persona fixa (cacheável) + dados da agência.
  const system = `${buildJarvisSystem(ASSISTANT_NAME, AGENCY_NAME)}\n\n## DADOS DA AGÊNCIA\n${agencySnapshotForAI()}`;

  const stream = streamText({ system, messages: msgs, effort: "low", maxTokens: 8000 });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
