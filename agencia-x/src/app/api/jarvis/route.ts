/**
 * POST /api/jarvis — chat com o assistente (streaming).
 * Body: { messages: [{ role: "user"|"assistant", content: string }] }
 * O assistente recebe um retrato atualizado da agência (do banco) a cada pergunta.
 */
import { z } from "zod";
import { streamText } from "@/lib/ai/claude";
import { buildJarvisSystem } from "@/lib/ai/prompts/jarvis";
import { can, getUser } from "@/lib/session";
import { agencySnapshotForAI, aiUsage } from "@/server/queries";
import { ASSISTANT_NAME } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20000) }))
    .min(1)
    .max(60),
});

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
  if (user.role === "CLIENT") return Response.json({ error: "Indisponível no portal." }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagens inválidas" }, { status: 400 });

  const msgs = parsed.data.messages;
  if (msgs[0].role !== "user") msgs.shift(); // a API exige começar com o usuário

  const [{ agencyName }, snapshot] = await Promise.all([
    aiUsage(user.agencyId),
    agencySnapshotForAI(user.agencyId, { finance: can(user.role, "finance:read") }),
  ]);

  // Persona fixa (cacheada) + dados vivos da agência em bloco separado.
  const stream = streamText({
    system: buildJarvisSystem(ASSISTANT_NAME, agencyName),
    systemDynamic: `Usuário atual: ${user.name}.\n\n## DADOS DA AGÊNCIA\n${snapshot}`,
    messages: msgs,
    effort: "low",
    maxTokens: 8000,
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
