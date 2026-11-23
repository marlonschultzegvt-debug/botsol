/**
 * /api/cron/publish — rodada do publicador automático.
 * Chamada a cada 5 minutos pelo agendador do banco (Supabase pg_cron) e,
 * como reserva, 1x por dia pelo Vercel Cron. Protegida por CRON_SECRET.
 */
import { timingSafeEqual } from "node:crypto";
import { runPublisher } from "@/server/publisher";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "não autorizado" }, { status: 401 });
  const report = await runPublisher();
  return Response.json({ ok: true, at: new Date().toISOString(), ...report });
}

export const GET = handle;
export const POST = handle;
