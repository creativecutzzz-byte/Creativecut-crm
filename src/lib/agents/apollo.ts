import "server-only";

import { z } from "zod";
import { cleanUrl, createLead, existingCompanies, existingRefs, normalizeCompany } from "./leads";
import { defineAgent } from "./types";

// Apollo agent (Apollo / CRM Search / Contact Enrichment):
// 1. Finds the founder/marketing contact at companies the Funding News agent
//    added (those leads have a company but no person or email yet).
// 2. Searches Apollo for new ICP people and imports them with their email.
//
// People search is free; revealing an email (people/match) costs Apollo
// credits — capped per run by max_credits_per_run.

const API = "https://api.apollo.io/api/v1";

const config = z.object({
  titles: z.array(z.string()).min(1).max(20),
  locations: z.array(z.string()).max(10),
  employee_ranges: z.array(z.string().regex(/^\d+,\d+$/)).max(10),
  keywords: z.string().max(200),
  new_people_per_run: z.number().int().min(0).max(50),
  find_contacts_for_funding_leads: z.boolean(),
  max_credits_per_run: z.number().int().min(0).max(200),
});
type Config = z.infer<typeof config>;

interface SearchPerson {
  id: string;
  first_name?: string;
  title?: string;
  has_email?: boolean;
  organization?: { name?: string };
}

interface MatchPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string | null;
  linkedin_url?: string | null;
  organization?: { name?: string; website_url?: string | null; primary_domain?: string | null; estimated_num_employees?: number | null; industry?: string | null } | null;
}

export const apolloAgent = defineAgent<Config>({
  key: "apollo",
  name: "Apollo Agent",
  department: "lead_generation",
  description: "Finds founders and marketing heads at ICP companies on Apollo (and at freshly funded startups), with verified emails.",
  requires: ["APOLLO_API_KEY"],
  needsAi: false,
  configSchema: config,
  defaultConfig: {
    titles: ["Founder", "Co-Founder", "CEO", "Head of Marketing", "Head of Growth", "Marketing Manager", "Product Marketing Manager"],
    locations: ["India"],
    employee_ranges: ["11,50", "51,200"],
    keywords: "B2B SaaS",
    new_people_per_run: 10,
    find_contacts_for_funding_leads: true,
    max_credits_per_run: 20,
  },
  configHelp:
    "titles / locations / employee_ranges (\"min,max\") / keywords: Apollo search filters. new_people_per_run: new contacts to import each run. find_contacts_for_funding_leads: look up the founder for companies from funding news. max_credits_per_run: upper limit on Apollo credits (1 per revealed email).",

  async run(ctx, cfg) {
    let credits = 0;
    let created = 0;
    let updated = 0;
    const notes: string[] = [];

    // 1. Contacts for funding-news leads.
    if (cfg.find_contacts_for_funding_leads) {
      const { data: pending } = await ctx.supabase
        .from("leads")
        .select("id, name, company, website, tags")
        .eq("org_id", ctx.orgId)
        .eq("source", "funding_news")
        .is("email", null)
        .not("tags", "cs", '{"apollo-checked"}')
        .order("created_at", { ascending: false })
        .limit(10);
      for (const lead of pending ?? []) {
        if (credits >= cfg.max_credits_per_run) break;
        const company = (lead.company as string) ?? (lead.name as string);
        const people = await search({ person_titles: ["Founder", "Co-Founder", "CEO", "Head of Marketing"], q_keywords: company, per_page: 10, page: 1 });
        const target = normalizeCompany(company);
        const match = people.find((p) => p.organization?.name && normalizeCompany(p.organization.name) === target);
        let person: MatchPerson | null = null;
        if (match) {
          person = await reveal(match.id);
          credits++;
        }
        const tags = [...((lead.tags as string[]) ?? []), "apollo-checked"];
        if (person?.email) {
          const fullName = person.name || [person.first_name, person.last_name].filter(Boolean).join(" ");
          await ctx.supabase
            .from("leads")
            .update({
              name: fullName || lead.name,
              email: person.email,
              linkedin_url: person.linkedin_url ?? null,
              website: (lead.website as string | null) ?? cleanUrl(person.organization?.website_url ?? person.organization?.primary_domain),
              tags,
            })
            .eq("id", lead.id);
          await ctx.supabase.from("activities").insert({ org_id: ctx.orgId, lead_id: lead.id, type: "system", body: `Apollo found ${fullName}${person.title ? `, ${person.title}` : ""} (${person.email})` });
          updated++;
        } else {
          await ctx.supabase.from("leads").update({ tags }).eq("id", lead.id);
        }
      }
      if (pending?.length) notes.push(`found contacts for ${updated} of ${pending.length} funded companies`);
    }

    // 2. New ICP people.
    if (cfg.new_people_per_run > 0 && credits < cfg.max_credits_per_run) {
      let page = Number(ctx.state.page ?? 1) || 1;
      const people = (
        await search({
          person_titles: cfg.titles,
          person_locations: cfg.locations,
          organization_num_employees_ranges: cfg.employee_ranges,
          q_keywords: cfg.keywords || undefined,
          per_page: 25,
          page,
        })
      ).filter((p) => p.has_email !== false);
      page = people.length === 0 ? 1 : page + 1;

      const seen = await existingRefs(ctx, people.map((p) => `apollo:${p.id}`));
      const companies = await existingCompanies(ctx);
      for (const p of people) {
        if (created >= cfg.new_people_per_run || credits >= cfg.max_credits_per_run) break;
        if (seen.has(`apollo:${p.id}`)) continue;
        if (p.organization?.name && companies.has(normalizeCompany(p.organization.name))) continue;
        const person = await reveal(p.id);
        credits++;
        if (!person?.email) continue;
        const org = person.organization;
        const fullName = person.name || [person.first_name, person.last_name].filter(Boolean).join(" ");
        const ok = await createLead(ctx, {
          name: fullName || p.first_name || "Unknown",
          company: org?.name ?? p.organization?.name ?? null,
          email: person.email,
          website: cleanUrl(org?.website_url ?? org?.primary_domain),
          linkedin_url: person.linkedin_url ?? null,
          source: "apollo",
          external_ref: `apollo:${p.id}`,
          ai_summary: [person.title, org?.industry, org?.estimated_num_employees ? `${org.estimated_num_employees} employees` : null].filter(Boolean).join(" · ") || null,
          tags: ["apollo", person.title ?? ""].filter(Boolean),
          activity: `Imported from Apollo: ${person.title ?? "contact"} at ${org?.name ?? "unknown company"}`,
        });
        if (ok) {
          created++;
          if (org?.name) companies.add(normalizeCompany(org.name));
        }
      }
      notes.push(`imported ${created} new contacts`);
      return { status: "success", summary: `Apollo: ${notes.join("; ")}. Credits used: ~${credits}.`, created, updated, state: { page } };
    }

    return { status: "success", summary: `Apollo: ${notes.join("; ") || "nothing to do"}. Credits used: ~${credits}.`, created, updated };
  },
});

async function apollo<T>(path: string, params: Record<string, string | number | boolean | string[] | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(`${key}[]`, v));
    else qs.set(key, String(value));
  }
  const res = await fetch(`${API}/${path}?${qs}`, {
    method: "POST",
    headers: { "x-api-key": process.env.APOLLO_API_KEY!, "Content-Type": "application/json", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apollo ${path} failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function search(params: Record<string, string | number | string[] | undefined>) {
  const res = await apollo<{ people?: SearchPerson[] }>("mixed_people/api_search", params);
  return res.people ?? [];
}

async function reveal(id: string) {
  const res = await apollo<{ person?: MatchPerson | null }>("people/match", { id, reveal_personal_emails: false });
  return res.person ?? null;
}
