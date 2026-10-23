import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

// Public endpoint for website forms (e.g. landing/index.html). It only calls
// the capture_lead() database function, which validates input and creates the
// lead, an activity and a "reply within 1 hour" task.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const schema = z.object({
  workspace: z.string().min(1).max(120),
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.email("Please enter a valid work email").max(254),
  company: z.string().trim().max(160).optional(),
  website: z.string().trim().max(300).optional(),
  message: z.string().trim().max(2000).optional(),
  // Honeypot: real visitors never see or fill this field.
  fax: z.string().max(0).optional(),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.json({ error: "The CRM isn't connected to a database yet." }, { status: 503, headers: CORS });

  const contentType = request.headers.get("content-type") ?? "";
  let body: unknown;
  try {
    body = contentType.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: CORS });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Bots that fill the honeypot get a normal-looking success.
    if (parsed.error.issues.some((i) => i.path[0] === "fax")) return NextResponse.json({ ok: true }, { headers: CORS });
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400, headers: CORS });
  }

  const { workspace, name, email, company, website, message } = parsed.data;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { error } = await supabase.rpc("capture_lead", {
    p_org_slug: workspace,
    p_name: name,
    p_email: email,
    p_company: company || null,
    p_website: website || null,
    p_message: message || null,
  });
  if (error) {
    const known = ["invalid name", "invalid email", "input too long", "unknown workspace"].find((m) => error.message.includes(m));
    return NextResponse.json({ error: known ? `Couldn't submit: ${known}` : "Something went wrong. Please email us instead." }, { status: known ? 400 : 500, headers: CORS });
  }

  return NextResponse.json({ ok: true }, { headers: CORS });
}
