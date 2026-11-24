/**
 * POST /api/jarvis — chat com o assistente, com ferramentas (gerar carrossel, propor agendamento...).
 * Body: { messages: [{ role, content, note? }] }  (note = registro interno, ex.: geracao_id de uma mídia)
 * Resposta: NDJSON, um evento por linha (ver JarvisEvent em lib/ai/jarvis-tools).
 * Nenhuma ferramenta publica: agendar só mostra um cartão que o usuário confirma.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropic, friendlyError, MODEL } from "@/lib/ai/claude";
import { claudeCostUsd } from "@/lib/ai/pricing";
import { buildJarvisSystem } from "@/lib/ai/prompts/jarvis";
import { JARVIS_TOOLS, runJarvisTool, type JarvisEvent } from "@/lib/ai/jarvis-tools";
import { db } from "@/lib/db";
import { can, getUser } from "@/lib/session";
import { agencySnapshotForAI, aiUsage } from "@/server/queries";
import { ASSISTANT_NAME, TZ } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_STEPS = 5;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000), note: z.string().max(4000).optional() }))
    .min(1)
    .max(60),
});

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Faça login novamente." }, { status: 401 });
  if (user.role === "CLIENT") return Response.json({ error: "Indisponível no portal." }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagens inválidas" }, { status: 400 });

  // Notas internas entram no texto que o modelo vê (o usuário não vê).
  const msgs: Anthropic.Beta.BetaMessageParam[] = parsed.data.messages
    .map((m) => ({ role: m.role, content: [m.content, m.note && `[registro interno: ${m.note}]`].filter(Boolean).join("\n\n") }))
    .filter((m) => m.content.trim());
  while (msgs.length && msgs[0].role !== "user") msgs.shift(); // a API exige começar com o usuário
  if (!msgs.length) return Response.json({ error: "Mensagens inválidas" }, { status: 400 });

  const [{ agencyName }, snapshot] = await Promise.all([
    aiUsage(user.agencyId),
    agencySnapshotForAI(user.agencyId, { finance: can(user.role, "finance:read") }),
  ]);
  const now = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" }).format(new Date());
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: buildJarvisSystem(ASSISTANT_NAME, agencyName), cache_control: { type: "ephemeral" } },
    { type: "text", text: `Agora: ${now} (horário de Brasília). Usuário atual: ${user.name}.\n\n## DADOS DA AGÊNCIA\n${snapshot}` },
  ];
  const tools = can(user.role, "content:write") ? JARVIS_TOOLS : [];

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: JarvisEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      let costUsd = 0;
      let inTok = 0;
      let outTok = 0;
      let model = MODEL;
      let lastText = "";
      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const stream = anthropic.beta.messages.stream({
            model: MODEL,
            max_tokens: 8000,
            system,
            messages: msgs,
            tools,
            output_config: { effort: "low" },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          });
          for await (const ev of stream) {
            if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") emit({ t: "text", d: ev.delta.text });
            if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
              emit({ t: "tool", name: ev.content_block.name, state: "start" });
            }
          }
          const final = await stream.finalMessage();
          model = final.model;
          inTok += final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0);
          outTok += final.usage.output_tokens;
          costUsd += claudeCostUsd(final.model, final.usage.input_tokens + (final.usage.cache_creation_input_tokens ?? 0), final.usage.output_tokens)
            + claudeCostUsd(final.model, Math.round((final.usage.cache_read_input_tokens ?? 0) * 0.1), 0);
          lastText = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");

          if (final.stop_reason === "refusal") { emit({ t: "text", d: "\n\n> ⚠️ Não posso ajudar com esse pedido. Reformule, chefe." }); break; }
          if (final.stop_reason === "max_tokens") { emit({ t: "text", d: "\n\n> ⚠️ Resposta cortada por tamanho. Peça menos itens por vez." }); break; }
          if (final.stop_reason !== "tool_use") break;

          // Devolve o turno inteiro (inclui raciocínio e chamadas) e executa as ferramentas.
          msgs.push({ role: "assistant", content: final.content as Anthropic.Beta.BetaContentBlockParam[] });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const b of final.content) {
            if (b.type !== "tool_use") continue;
            try {
              const r = await runJarvisTool(b.name, b.input, user, emit);
              costUsd += r.costUsd ?? 0;
              emit({ t: "tool", name: b.name, state: r.isError ? "error" : "done", msg: r.isError ? r.content : undefined });
              results.push({ type: "tool_result", tool_use_id: b.id, content: r.content, is_error: r.isError });
            } catch (e) {
              console.error("[jarvis] tool", b.name, e);
              const msg = e instanceof Error ? e.message : "falha na ferramenta";
              emit({ t: "tool", name: b.name, state: "error", msg });
              results.push({ type: "tool_result", tool_use_id: b.id, content: `Erro: ${msg}`, is_error: true });
            }
          }
          msgs.push({ role: "user", content: results });
          emit({ t: "text", d: "\n\n" });
        }
      } catch (err) {
        console.error("[jarvis] stream", err);
        emit({ t: "error", msg: friendlyError(err) });
      } finally {
        costUsd = +costUsd.toFixed(4);
        await db.aiGeneration
          .create({
            data: {
              agencyId: user.agencyId, userId: user.id, type: "JARVIS",
              input: { pergunta: parsed.data.messages.at(-1)?.content.slice(0, 2000) ?? "" },
              output: lastText.slice(0, 20000), model, provider: "claude", inputTokens: inTok, outputTokens: outTok, costUsd,
            },
          })
          .catch((e) => console.error("[jarvis] log", e));
        emit({ t: "done", costUsd });
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
