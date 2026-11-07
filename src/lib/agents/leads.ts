import "server-only";

import type { AgentContext } from "./types";

// Shared helpers agents use to write into the CRM.

export interface NewLead {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedin_url?: string | null;
  source: "apollo" | "google_maps" | "funding_news";
  external_ref: string;
  ai_score?: number | null;
  ai_summary?: string | null;
  personalization?: string | null;
  tags?: string[];
  activity: string;
}

/** Which of these refs already exist in the workspace. */
export async function existingRefs(ctx: AgentContext, refs: string[]) {
  if (refs.length === 0) return new Set<string>();
  const { data, error } = await ctx.supabase.from("leads").select("external_ref").eq("org_id", ctx.orgId).in("external_ref", refs);
  if (error) throw new Error(`Couldn't check existing leads: ${error.message}`);
  return new Set((data ?? []).map((r) => r.external_ref as string));
}

/** Lower-cased company names already in the CRM (leads and clients), to avoid duplicates across sources. */
export async function existingCompanies(ctx: AgentContext) {
  const [leads, clients] = await Promise.all([
    ctx.supabase.from("leads").select("company").eq("org_id", ctx.orgId).not("company", "is", null).limit(5000),
    ctx.supabase.from("clients").select("company").eq("org_id", ctx.orgId).not("company", "is", null).limit(5000),
  ]);
  return new Set([...(leads.data ?? []), ...(clients.data ?? [])].map((r) => normalizeCompany(r.company as string)));
}

export function normalizeCompany(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|llp|technologies|technology|labs|ai)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Inserts a lead plus a "found by agent" activity. Returns false when it already existed. */
export async function createLead(ctx: AgentContext, lead: NewLead): Promise<boolean> {
  const { activity, ...row } = lead;
  const contact = [lead.email?.toLowerCase(), lead.phone?.replace(/\D/g, "")].filter((v): v is string => Boolean(v));
  if (contact.length) {
    const { count } = await ctx.supabase.from("suppressions").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).in("value", contact);
    if (count) return false;
  }
  const { data, error } = await ctx.supabase
    .from("leads")
    .insert({
      ...row,
      tags: row.tags ?? [],
      org_id: ctx.orgId,
      owner_id: ctx.ownerId,
      stage: "new",
      next_follow_up_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return false;
    throw new Error(`Couldn't create lead "${lead.name}": ${error.message}`);
  }
  await ctx.supabase.from("activities").insert({ org_id: ctx.orgId, lead_id: data.id, type: "system", body: activity });
  return true;
}

export function cleanUrl(url: string | null | undefined) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
