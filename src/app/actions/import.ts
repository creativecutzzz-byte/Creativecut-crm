"use server";

import { scoreLead } from "@/lib/ai/lead-scoring";
import { requireWorkspace, type ActionState } from "@/lib/actions";
import { LEAD_SOURCES } from "@/lib/constants";
import type { LeadSource } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MAX_ROWS = 500;

// Research columns (e.g. playbook/prospects-2026-10.csv) are kept as a note on the lead's timeline.
const NOTE_COLUMNS: [string, string][] = [
  ["what_they_do", "What they do"],
  ["funding", "Funding"],
  ["funding_date", "Funding date"],
  ["lead_investor", "Lead investor"],
  ["city", "City"],
  ["fit_note", "Fit"],
  ["source_url", "Source"],
  ["notes", "Notes"],
];

const rowSchema = z.object({
  name: z.string().max(120),
  company: z.string().max(160),
  email: z.union([z.literal(""), z.email()]),
  phone: z.string().max(40),
  whatsapp_number: z.string().max(40),
  instagram_handle: z.string().max(80),
  website: z.string().max(300),
  personalization: z.string().max(600),
  source: z.string(),
  estimated_value: z.string(),
});

function pick(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) if (row[key]) return row[key]!;
  return "";
}

/** Imports prospects parsed from a CSV in the browser. Skips rows already in the CRM (same email, website or company). */
export async function importLeads(_: ActionState, formData: FormData): Promise<ActionState> {
  let rows: Record<string, string>[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
    if (!Array.isArray(rows)) throw new Error();
  } catch {
    return { error: "Couldn't read that file." };
  }
  if (rows.length === 0) return { error: "No rows found. The first line must be a header row." };
  if (rows.length > MAX_ROWS) return { error: `Import at most ${MAX_ROWS} rows at a time.` };

  const ws = await requireWorkspace();
  if ("error" in ws) return ws;
  const { supabase, viewer } = ws;

  const { data: existing, error: loadError } = await supabase.from("leads").select("email, website, company");
  if (loadError) return { error: loadError.message };
  const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const seen = new Set(existing.flatMap((l) => [norm(l.email), norm(l.website), norm(l.company)]).filter(Boolean));

  const leads: Record<string, unknown>[] = [];
  const notes: (string | null)[] = [];
  const problems: string[] = [];
  let duplicates = 0;

  rows.forEach((raw, i) => {
    const candidate = {
      name: pick(raw, "name", "contact_name", "contact", "full_name"),
      company: pick(raw, "company", "company_name", "organisation", "organization"),
      email: pick(raw, "email", "work_email").toLowerCase(),
      phone: pick(raw, "phone"),
      whatsapp_number: pick(raw, "whatsapp", "whatsapp_number"),
      instagram_handle: pick(raw, "instagram", "instagram_handle").replace(/^@/, ""),
      website: pick(raw, "website", "url", "site"),
      personalization: pick(raw, "personalization", "personalisation", "personalization_line"),
      source: pick(raw, "source", "lead_source").toLowerCase().replace(/\s+/g, "_"),
      estimated_value: pick(raw, "estimated_value", "value", "deal_value"),
    };
    const parsed = rowSchema.safeParse(candidate);
    const line = i + 2;
    if (!parsed.success) return void problems.push(`Row ${line}: ${parsed.error.issues[0]?.path.join(".")} is invalid`);
    const r = parsed.data;
    const name = r.name || r.company;
    if (name.length < 2) return void problems.push(`Row ${line}: needs a name or company`);

    const keys = [norm(r.email), norm(r.website), norm(r.company)].filter(Boolean);
    if (keys.some((k) => seen.has(k))) return void duplicates++;
    keys.forEach((k) => seen.add(k));

    const source: LeadSource = r.source in LEAD_SOURCES ? (r.source as LeadSource) : "other";
    const value = Number(r.estimated_value.replace(/[^\d.]/g, "")) || 0;
    const lead = {
      name,
      company: r.company || null,
      email: r.email || null,
      phone: r.phone || null,
      whatsapp_number: r.whatsapp_number || null,
      instagram_handle: r.instagram_handle || null,
      website: r.website || null,
      personalization: r.personalization || null,
      source,
      stage: "new" as const,
      estimated_value: value,
      service_interest: [] as string[],
      marketing_consent: false,
      last_contacted_at: null,
    };
    leads.push({ ...lead, org_id: viewer.orgId, owner_id: viewer.userId, ai_score: scoreLead(lead).score });

    const note = NOTE_COLUMNS.filter(([key]) => raw[key]).map(([key, label]) => `${label}: ${raw[key]}`).join("\n");
    notes.push(note || null);
  });

  if (leads.length) {
    const { data: inserted, error } = await supabase.from("leads").insert(leads).select("id");
    if (error) return { error: error.message };
    const activities = inserted.flatMap((lead, i) => [
      { org_id: viewer.orgId, lead_id: lead.id, actor_id: viewer.userId, type: "system" as const, body: "Imported from CSV" },
      ...(notes[i] ? [{ org_id: viewer.orgId, lead_id: lead.id, actor_id: viewer.userId, type: "note" as const, body: `Research\n${notes[i]}` }] : []),
    ]);
    await supabase.from("activities").insert(activities);
  }

  revalidatePath("/leads");
  revalidatePath("/dashboard");
  const parts = [`${leads.length} imported`];
  if (duplicates) parts.push(`${duplicates} already in the CRM`);
  if (problems.length) parts.push(`${problems.length} skipped (${problems.slice(0, 3).join("; ")}${problems.length > 3 ? "…" : ""})`);
  return { ok: leads.length > 0, error: leads.length ? undefined : parts.join(" · "), message: parts.join(" · ") };
}
