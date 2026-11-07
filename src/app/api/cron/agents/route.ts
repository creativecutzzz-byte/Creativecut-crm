import { runScheduled } from "@/lib/agents/runner";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

// Scheduled run of every enabled agent. Vercel Cron calls this with
// "Authorization: Bearer $CRON_SECRET" (see vercel.json).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });

  const results = await runScheduled(supabase);
  return NextResponse.json({ ran: results.length, results });
}
