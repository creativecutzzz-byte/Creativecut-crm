import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "./db/pool";
import { logEvent } from "./db/queries";

// Every cron route verifies the CRON_SECRET bearer token Vercel sends.

export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Wraps a cron job: auth, DB check, ONE small batch of work, JSON result, error event. */
export async function runCron(req: Request, name: string, job: () => Promise<unknown>) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ ok: false, error: "DATABASE_URL is not set" }, { status: 503 });
  if (process.env.ENGINE_ENABLED === "false") return NextResponse.json({ ok: true, skipped: "ENGINE_ENABLED=false" });
  const started = Date.now();
  try {
    const result = await job();
    return NextResponse.json({ ok: true, job: name, ms: Date.now() - started, result });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logEvent("cron_failed", { job: name, error: error.slice(0, 500) });
    return NextResponse.json({ ok: false, job: name, error }, { status: 500 });
  }
}
