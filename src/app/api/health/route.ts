import { isDatabaseConfigured, one } from "@/lib/engine/db/pool";
import { NextResponse } from "next/server";

// Liveness + database reachability. Reveals no configuration values.
export const dynamic = "force-dynamic";

export async function GET() {
  let db: "ok" | "not_configured" | "error" = "not_configured";
  if (isDatabaseConfigured()) {
    try {
      await one("select 1 from outreach.domains limit 1");
      db = "ok";
    } catch {
      db = "error";
    }
  }
  return NextResponse.json({ ok: db !== "error", db }, { status: db === "error" ? 503 : 200 });
}
