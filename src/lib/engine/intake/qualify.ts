import { stringify } from "yaml";
import { z } from "zod/v4";
import { icpConfig } from "../config";
import { claimLeads, logEvent, releaseLead, setLeadStatus, type LeadRow } from "../db/queries";
import { prompt } from "../prompts";
import { fetchPage } from "../research/fetch";
import { isAiReady, jsonWithFallback, smallModelChain } from "../research/models";
import { ruleCheck } from "./normalize";

// ICP qualification in two layers (docs/guide.md, Step 5): free rules first,
// then a small model scores the fuzzy fit from the cached homepage text.

export const QualifySchema = z.object({
  score: z.number().int().min(0).max(100),
  qualified: z.boolean(),
  reason: z.string(),
});

export async function qualifyLead(lead: LeadRow) {
  const icp = icpConfig();
  const rules = ruleCheck(lead, icp);
  if (!rules.ok) return setLeadStatus(lead.id, "disqualified", { icp_score: 0, icp_reason: rules.reason });

  const home = lead.website ? await fetchPage(lead.website) : null;
  if (!home?.text) return setLeadStatus(lead.id, "disqualified", { icp_score: 0, icp_reason: "Website could not be read (blocked, empty or unreachable)" });

  const icpForPrompt = { industries: icp.industries, employee_range: icp.employee_range, target_titles: icp.target_titles, allowed_countries: icp.allowed_countries, exclude: icp.exclude };
  const p = prompt("qualify", {
    icp: stringify(icpForPrompt).trim(),
    title: lead.title ?? "unknown title",
    company: lead.company,
    country: lead.country,
    website_text: home.text.slice(0, 3000),
  });
  try {
    const { data } = await jsonWithFallback(QualifySchema, p.system, p.input, { chain: smallModelChain(), maxTokens: 1000, purpose: "qualify" });
    const qualified = data.qualified && data.score >= icp.min_score;
    await setLeadStatus(lead.id, qualified ? "qualified" : "disqualified", { icp_score: data.score, icp_reason: data.reason });
  } catch (err) {
    // Retry once on a later tick, then send to manual review instead of guessing.
    if (lead.attempts >= 1) {
      await setLeadStatus(lead.id, "review", { icp_reason: `AI scoring failed twice: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) });
    } else {
      await releaseLead(lead.id);
    }
  }
}

export async function qualifyLeads(batch = 8) {
  if (!isAiReady()) return { processed: 0, skipped: "ANTHROPIC_API_KEY is not set" };
  const leads = await claimLeads("verified", batch);
  const results = await Promise.allSettled(leads.map(qualifyLead));
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  if (failed.length) await logEvent("qualify_failed", { count: failed.length, error: String(failed[0]!.reason) });
  return { processed: leads.length, failed: failed.length };
}
