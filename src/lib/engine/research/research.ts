import { z } from "zod/v4";
import { senderIdentity } from "../config";
import { claimLeads, logEvent, releaseLead, setLeadStatus, type LeadRow } from "../db/queries";
import { tx } from "../db/pool";
import { prompt } from "../prompts";
import { fetchSite, type Page } from "./fetch";
import { hygieneProblems, pageWithQuote, quotePasses } from "./gate";
import { isAiReady, jsonWithFallback, smallModelChain } from "./models";

// Research engine (docs/guide.md, Step 6): fetch -> extract + draft -> gate.
// On pass: research row + steps 1-3 (step 1 ready now; 2 and 3 are scheduled by
// the sender after the previous step goes out). On fail: one retry with the
// failure reason, then the lead is skipped.

export const DraftSchema = z.object({
  evidence_quote: z.string().nullable(),
  evidence_url: z.string().nullable(),
  subject: z.string(),
  body: z.string(),
  followup_1: z.string(),
  followup_2: z.string(),
});
export type Draft = z.infer<typeof DraftSchema>;

const FaithSchema = z.object({ answer: z.enum(["yes", "no"]), problem: z.string() });

const PAGE_CHARS = 6000;

export function pagesForPrompt(pages: Page[]) {
  const per = Math.floor(PAGE_CHARS / Math.max(pages.length, 1));
  return pages.map((p) => `=== ${p.url}\n${p.text.slice(0, per)}`).join("\n\n");
}

/** Runs the three gate checks. Returns failures (empty = pass) and the page that holds the quote. */
export async function runGate(draft: Draft, pages: Page[]) {
  const failures: string[] = [];
  let evidenceUrl: string | null = null;
  if (draft.evidence_quote) {
    // The model only saw the first part of each page, so check against what it saw.
    const seen = pages.map((p) => ({ url: p.url, text: p.text.slice(0, Math.floor(PAGE_CHARS / pages.length)) }));
    const page = pageWithQuote(draft.evidence_quote, seen, draft.evidence_url);
    if (!page || !quotePasses(draft.evidence_quote, page.text)) failures.push("evidence_quote does not appear word for word on the page (or is shorter than 6 words)");
    else evidenceUrl = page.url;
  }
  failures.push(...hygieneProblems({ subject: draft.subject, body: draft.body, followups: [draft.followup_1, draft.followup_2] }));
  if (!failures.length) {
    const p = prompt("faithfulness", {
      quote: draft.evidence_quote ?? "(none — generic email)",
      emails: [`Subject: ${draft.subject}`, draft.body, `Follow-up 1: ${draft.followup_1}`, `Follow-up 2: ${draft.followup_2}`].join("\n\n"),
    });
    const { data } = await jsonWithFallback(FaithSchema, p.system, p.input, { chain: smallModelChain(), maxTokens: 600, purpose: "faithfulness" });
    if (data.answer !== "yes") failures.push(`faithfulness: ${data.problem || "a claim does not follow from the quote"}`);
  }
  return { failures, evidenceUrl };
}

export async function researchLead(lead: LeadRow) {
  const started = Date.now();
  const pages = lead.website ? await fetchSite(lead.website, 2) : [];
  if (!pages.length) return setLeadStatus(lead.id, "skipped", { icp_reason: "Website could not be read for research" });

  const identity = senderIdentity();
  let feedback = "";
  let lastFailures: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = prompt("draft", {
      company_name: identity.company,
      offer: identity.offer,
      feedback,
      first_name: lead.first_name,
      title: lead.title ?? "unknown title",
      company: lead.company,
      pages: pagesForPrompt(pages),
    });
    const { model, data } = await jsonWithFallback(DraftSchema, p.system, p.input, { maxTokens: 2500, purpose: "draft" });
    const draft = { ...data, subject: data.subject.trim(), body: data.body.trim(), followup_1: data.followup_1.trim(), followup_2: data.followup_2.trim() };
    const { failures, evidenceUrl } = await runGate(draft, pages);
    if (!failures.length) {
      await saveResearch(lead, draft, evidenceUrl, model, Date.now() - started, attempt);
      return;
    }
    lastFailures = failures;
    feedback = `\nYour previous draft failed the quality check: ${failures.join("; ")}. Fix exactly that. Copy the quote character for character.`;
  }
  await tx(async (db) => {
    await db.query(
      `insert into outreach.research (lead_id, gate_passed, gate_failures, duration_ms) values ($1, false, $2, $3)
         on conflict (lead_id) do update set gate_passed = false, gate_failures = excluded.gate_failures, duration_ms = excluded.duration_ms, created_at = now()`,
      [lead.id, lastFailures, Date.now() - started],
    );
    await setLeadStatus(lead.id, "skipped", { icp_reason: `Quality gate failed twice: ${lastFailures.join("; ")}`.slice(0, 500) }, db);
  });
  await logEvent("gate_failed", { lead_id: lead.id, failures: lastFailures });
}

async function saveResearch(lead: LeadRow, d: Draft, evidenceUrl: string | null, model: string, durationMs: number, retries: number) {
  const generic = !d.evidence_quote;
  await tx(async (db) => {
    await db.query(
      `insert into outreach.research (lead_id, evidence_quote, evidence_url, facts, gate_passed, gate_failures, is_generic, model, duration_ms)
       values ($1, $2, $3, $4, true, '{}', $5, $6, $7)
       on conflict (lead_id) do update set evidence_quote = excluded.evidence_quote, evidence_url = excluded.evidence_url, facts = excluded.facts,
         gate_passed = true, gate_failures = '{}', is_generic = excluded.is_generic, model = excluded.model, duration_ms = excluded.duration_ms, created_at = now()`,
      [lead.id, d.evidence_quote, evidenceUrl, JSON.stringify({ retries }), generic, model, durationMs],
    );
    const followSubject = `Re: ${d.subject}`; // genuinely a reply in the same thread
    await db.query(
      `insert into outreach.steps (lead_id, step_no, subject, body, due_at, status) values
         ($1, 1, $2, $3, now(), 'ready'), ($1, 2, $4, $5, null, 'ready'), ($1, 3, $4, $6, null, 'ready')
       on conflict (lead_id, step_no) do nothing`,
      [lead.id, d.subject, d.body, followSubject, d.followup_1, d.followup_2],
    );
    await setLeadStatus(lead.id, "ready", generic ? { segment: lead.segment ? `${lead.segment} (generic)` : "generic" } : {}, db);
  });
  await logEvent("researched", { lead_id: lead.id, model, duration_ms: durationMs, generic });
}

export async function researchLeads(batch = 8) {
  if (!isAiReady()) return { processed: 0, skipped: "ANTHROPIC_API_KEY is not set" };
  const leads = await claimLeads("qualified", batch);
  const results = await Promise.allSettled(
    leads.map(async (lead) => {
      try {
        await researchLead(lead);
      } catch (err) {
        // Model chain exhausted or DB hiccup: retry on a later tick, skip after 3 tries.
        if (lead.attempts >= 2) await setLeadStatus(lead.id, "skipped", { icp_reason: `Research failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) });
        else await releaseLead(lead.id);
        throw err;
      }
    }),
  );
  const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  if (failed.length) await logEvent("research_failed", { count: failed.length, error: String(failed[0]!.reason).slice(0, 500) });
  return { processed: leads.length, failed: failed.length };
}
