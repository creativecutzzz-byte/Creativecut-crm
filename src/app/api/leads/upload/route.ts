import { engineAccess } from "@/lib/engine/access";
import { isDatabaseConfigured } from "@/lib/engine/db/pool";
import { importLeadsCsv } from "@/lib/engine/intake/upload";
import { NextResponse, type NextRequest } from "next/server";

// POST /api/leads/upload — multipart form with a "file" field (CSV) or a raw
// text/csv body. Required columns: email, first_name, company, website.
// Optional: last_name, title, country, timezone, employees, segment.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const access = await engineAccess();
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 403 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL is not set." }, { status: 503 });

  let text = "";
  let source = "csv";
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach a CSV file in the \"file\" field." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "CSV is larger than 10 MB. Split it into smaller files." }, { status: 413 });
    text = await file.text();
    source = String(form.get("source") || file.name || "csv").slice(0, 80);
  } else {
    text = await request.text();
    if (text.length > MAX_BYTES) return NextResponse.json({ error: "CSV is larger than 10 MB." }, { status: 413 });
  }
  if (!text.trim()) return NextResponse.json({ error: "The CSV is empty." }, { status: 400 });

  const summary = await importLeadsCsv(text, source);
  return NextResponse.json(summary);
}
