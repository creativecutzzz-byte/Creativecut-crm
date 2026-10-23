import "server-only";

import type { Viewer } from "@/lib/data";
import { renderStep, SEQUENCES, sequenceVars, type SequenceKey } from "@/lib/sequences";
import type { createClient } from "@/lib/supabase/server";

// Automation rules (playbook/10-funnel-and-automation.md). Everything here
// creates or cancels tasks; nothing is ever sent to a lead or client.

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Member = Viewer & { orgId: string; userId: string };

const DAY = 86_400_000;
/** Day-0 steps get an hour's window instead of being overdue the moment they're created. */
const FIRST_STEP_WINDOW = 3_600_000;

export interface SequenceLead {
  id: string;
  name: string;
  company: string | null;
  personalization?: string | null;
  owner_id: string | null;
}

/** Creates one dated task per sequence step, assigned to the lead's owner. */
export async function startSequence(supabase: Supabase, viewer: Member, lead: SequenceLead, key: SequenceKey, start = Date.now() + FIRST_STEP_WINDOW) {
  const sequence = SEQUENCES[key];
  const vars = sequenceVars(lead, { name: viewer.fullName, bookingUrl: viewer.bookingUrl, portfolioUrl: viewer.portfolioUrl });
  const rows = sequence.steps.map((step) => ({
    org_id: viewer.orgId,
    lead_id: lead.id,
    assignee_id: lead.owner_id ?? viewer.userId,
    created_by: viewer.userId,
    sequence: key,
    priority: step.day === 0 ? ("high" as const) : ("medium" as const),
    due_at: new Date(start + step.day * DAY).toISOString(),
    ...renderStep(sequence, step, vars),
  }));
  const { error } = await supabase.from("tasks").insert(rows);
  if (error) return { error: error.message };

  await supabase.from("activities").insert({
    org_id: viewer.orgId,
    lead_id: lead.id,
    actor_id: viewer.userId,
    type: "system",
    body: `Started sequence: ${sequence.name}`,
  });
  return { ok: true as const };
}

/** Cancels the open steps of the given sequences (all sequences when omitted). Returns how many were cancelled. */
export async function stopSequences(supabase: Supabase, leadId: string, keys?: SequenceKey[]) {
  let query = supabase.from("tasks").update({ status: "cancelled" }).eq("lead_id", leadId).eq("status", "open").not("sequence", "is", null);
  if (keys) query = query.in("sequence", keys);
  const { data } = await query.select("id");
  return data?.length ?? 0;
}

export async function hasOpenSequence(supabase: Supabase, leadId: string, key: SequenceKey) {
  const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("lead_id", leadId).eq("sequence", key).eq("status", "open");
  return (count ?? 0) > 0;
}

/** The 14-day onboarding checklist from playbook/11-onboarding-and-retention.md. */
export const ONBOARDING_STEPS: { day: number; title: string; description?: string }[] = [
  { day: 0, title: "Send welcome email, agreement and first invoice", description: "Welcome email template: playbook section 11." },
  { day: 0, title: "Create the client folder and request assets", description: "Folder structure: playbook section 14, SOP 2." },
  { day: 1, title: "Kick-off call (45 min)", description: "Goals, product walkthrough, brand references, launch calendar, how we work, first two deliverables." },
  { day: 2, title: "Send brand and product profile for approval" },
  { day: 3, title: "Agree first month's content plan" },
  { day: 5, title: "Get script for motion piece #1 approved" },
  { day: 7, title: "First delivery (short-form batch or style frames)", description: "Early proof matters most this month." },
  { day: 10, title: "Check-in: \"How's it going so far? Anything we should change?\"" },
  { day: 14, title: "Deliver motion piece #1 and collect feedback" },
];

export async function createOnboardingTasks(supabase: Supabase, viewer: Member, clientId: string, assigneeId: string | null, start = Date.now() + FIRST_STEP_WINDOW) {
  const rows = ONBOARDING_STEPS.map((step, i) => ({
    org_id: viewer.orgId,
    client_id: clientId,
    assignee_id: assigneeId ?? viewer.userId,
    created_by: viewer.userId,
    title: `Onboarding: ${step.title}`,
    description: step.description ?? null,
    priority: step.day <= 1 ? ("high" as const) : ("medium" as const),
    due_at: new Date(start + step.day * DAY).toISOString(),
    dedupe_key: `onboarding:${clientId}:${i}`,
  }));
  await supabase.from("tasks").upsert(rows, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
}

/** Ensures every active or onboarding client has this month's "Monthly report" task, due on the 25th. */
export async function ensureMonthlyReportTasks(supabase: Supabase, orgId: string, now = new Date()) {
  const { data: clients } = await supabase.from("clients").select("id, name, company, owner_id").in("status", ["active", "onboarding"]);
  if (!clients?.length) return;
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const due = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 25, 4, 30)).toISOString(); // 10:00 IST
  const rows = clients.map((c) => ({
    org_id: orgId,
    client_id: c.id,
    assignee_id: c.owner_id,
    title: `Monthly report: ${c.company ?? c.name} (${month})`,
    description: "Delivered vs plan, top 2 pieces with numbers, what we learned, next month's plan, one proactive suggestion. Template: playbook section 11.",
    priority: "medium" as const,
    due_at: due,
    dedupe_key: `monthly-report:${c.id}:${month}`,
  }));
  await supabase.from("tasks").upsert(rows, { onConflict: "org_id,dedupe_key", ignoreDuplicates: true });
}
