import { stopSequence, suppress, logEvent } from "@/lib/engine/db/queries";
import { isDatabaseConfigured, one, tx } from "@/lib/engine/db/pool";
import { verifyUnsubToken } from "@/lib/engine/sender/unsubscribe";
import { NextResponse, type NextRequest } from "next/server";

// Unsubscribe for Outreach Engine emails. Handles the RFC 8058 one-click POST
// (List-Unsubscribe-Post) and a plain GET: both unsubscribe immediately, since
// the link only works with a valid HMAC token for that one lead.

export const dynamic = "force-dynamic";

async function unsubscribe(token: string | null) {
  const leadId = verifyUnsubToken(token);
  if (!leadId) return page("This link is invalid or has expired. Reply \"unsubscribe\" to our email instead.", 400);
  if (!isDatabaseConfigured()) return page("Something went wrong. Please reply \"unsubscribe\" to our email instead.", 503);
  const lead = await one<{ email: string }>(`select email from outreach.leads where id = $1`, [leadId]);
  if (lead) {
    await tx(async (db) => {
      await suppress(lead.email, "unsubscribed", db);
      await stopSequence(leadId, "unsubscribed", db);
    });
    await logEvent("unsubscribed", { lead_id: leadId, via: "link" });
  }
  return page("You're unsubscribed. You won't receive any more emails from us.");
}

export function GET(request: NextRequest) {
  return unsubscribe(request.nextUrl.searchParams.get("t"));
}

export function POST(request: NextRequest) {
  return unsubscribe(request.nextUrl.searchParams.get("t"));
}

function page(message: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title>
<style>body{font-family:system-ui,sans-serif;background:#fff;color:#111;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:420px;text-align:center}@media(prefers-color-scheme:dark){body{background:#0b0b10;color:#e7e7ee}}</style>
</head><body><main><p>${message}</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
