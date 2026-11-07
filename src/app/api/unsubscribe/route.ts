import { verifyUnsubscribeToken } from "@/lib/outreach/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

// One-click unsubscribe from outreach emails (RFC 8058).
// GET shows a confirmation button; POST (from the button or the mail client's
// List-Unsubscribe-Post) does the unsubscribe.

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!verifyUnsubscribeToken(token)) return page("This link is invalid or has expired.", null);
  return page("Stop receiving emails from Creative Cut?", token);
}

export async function POST(request: NextRequest) {
  const leadId = verifyUnsubscribeToken(request.nextUrl.searchParams.get("t"));
  if (!leadId) return page("This link is invalid or has expired.", null, 400);
  const supabase = createAdminClient();
  if (!supabase) return page("Something went wrong. Please reply “unsubscribe” to our email instead.", null, 503);

  const { data: lead } = await supabase.from("leads").select("id, org_id, email, whatsapp_number").eq("id", leadId).maybeSingle();
  if (lead) {
    const values = [lead.email?.toLowerCase(), lead.whatsapp_number?.replace(/\D/g, "")].filter((v): v is string => Boolean(v));
    await Promise.all([
      supabase.from("leads").update({ marketing_consent: false, outreach_status: "unsubscribed" }).eq("id", lead.id),
      supabase.from("outreach_drafts").update({ status: "cancelled", error: "Unsubscribed" }).eq("lead_id", lead.id).in("status", ["pending", "approved"]),
      values.length ? supabase.from("suppressions").upsert(values.map((value) => ({ org_id: lead.org_id, value, reason: "unsubscribe link" })), { onConflict: "org_id,value", ignoreDuplicates: true }) : Promise.resolve(),
      supabase.from("activities").insert({ org_id: lead.org_id, lead_id: lead.id, type: "system", body: "Unsubscribed via email link — will not be contacted again" }),
    ]);
  }
  return page("You're unsubscribed. You won't hear from us again.", null);
}

function page(message: string, token: string | null, status = 200) {
  const form = token
    ? `<form method="post" action="?t=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title>
<style>body{font-family:system-ui,sans-serif;background:#0b0b10;color:#e7e7ee;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}
main{max-width:420px;text-align:center}button{margin-top:16px;padding:10px 18px;border-radius:10px;border:0;background:#8b7cf6;color:#fff;font-size:15px;cursor:pointer}</style>
</head><body><main><p>${message}</p>${form}</main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
