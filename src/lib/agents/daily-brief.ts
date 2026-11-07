import "server-only";

import { z } from "zod";
import { extract, isAiConfigured } from "@/lib/ai/claude";
import { gmail } from "@/lib/integrations/gmail";
import { formatIst } from "@/lib/meetings/slots";
import { istDayStart } from "@/lib/outreach/plan";
import { outreachPerformance } from "@/lib/outreach/performance";
import { COMPANY_KNOWLEDGE } from "./knowledge";
import { defineAgent } from "./types";

// Daily Brief: one morning email with yesterday's numbers, today's meetings
// and tasks, hot replies and the pipeline; on Mondays also the weekly report
// (which messages got replies, A/B subject results). Also nudges stale deals.

const config = z.object({
  to: z.union([z.literal(""), z.email()]),
  weekly_day: z.number().int().min(0).max(6),
  stale_days: z.number().int().min(3).max(60),
});
type Config = z.infer<typeof config>;

const focus = z.object({ bullets: z.array(z.string()) });

const DAY = 86_400_000;

export const dailyBriefAgent = defineAgent<Config>({
  key: "daily_brief",
  name: "Daily Brief & Weekly Report",
  department: "crm_operations",
  description: "Every morning emails you yesterday's numbers, today's meetings and tasks, hot replies and the pipeline; Mondays add which messages get replies. Flags deals that went quiet.",
  requires: [],
  needsAi: false,
  configSchema: config,
  defaultConfig: { to: "hello@creativecut.in", weekly_day: 1, stale_days: 7 },
  configHelp: "to: where the brief goes. weekly_day: day for the weekly report (0=Sun … 6=Sat). stale_days: proposals/negotiations with no contact for this many days get a nudge task.",

  async run(ctx, cfg) {
    const now = new Date();
    const todayStart = istDayStart(now);
    const yStart = new Date(new Date(todayStart).getTime() - DAY).toISOString();
    const todayEnd = new Date(new Date(todayStart).getTime() + DAY).toISOString();
    const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    const sb = ctx.supabase;
    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

    const [newLeads, emailsSent, inbound, meetingsBooked, meetingsToday, tasksDue, approvals, openLeads] = await Promise.all([
      sb.from("leads").select("source").eq("org_id", ctx.orgId).gte("created_at", yStart).lt("created_at", todayStart),
      count(sb.from("messages").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("direction", "outbound").eq("status", "sent").gte("created_at", yStart).lt("created_at", todayStart)),
      sb.from("messages").select("lead_id, channel, body, classification, created_at").eq("org_id", ctx.orgId).eq("direction", "inbound").gte("created_at", yStart),
      count(sb.from("meetings").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).gte("created_at", yStart).lt("created_at", todayStart)),
      sb.from("meetings").select("lead_id, title, starts_at, meet_url").eq("org_id", ctx.orgId).eq("status", "scheduled").gte("starts_at", todayStart).lt("starts_at", todayEnd).order("starts_at"),
      count(sb.from("tasks").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("status", "open").lt("due_at", todayEnd)),
      count(sb.from("outreach_drafts").select("id", { count: "exact", head: true }).eq("org_id", ctx.orgId).eq("status", "pending")),
      sb.from("leads").select("id, name, company, stage, estimated_value, last_contacted_at, owner_id").eq("org_id", ctx.orgId).in("stage", ["new", "contacted", "qualified", "meeting", "proposal", "negotiation"]).limit(5000),
    ]);

    const leadsById = new Map((openLeads.data ?? []).map((l) => [l.id as string, l]));
    const name = (id: string | null) => {
      const l = id ? leadsById.get(id) : null;
      return l ? `${l.name}${l.company && l.company !== l.name ? ` (${l.company})` : ""}` : "a lead";
    };

    // Stale deals → nudge task (once a week per lead).
    const staleCutoff = new Date(now.getTime() - cfg.stale_days * DAY).toISOString();
    const week = `${now.getUTCFullYear()}-w${Math.ceil((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / (7 * DAY))}`;
    const stale = (openLeads.data ?? []).filter((l) => ["proposal", "negotiation"].includes(l.stage as string) && (!l.last_contacted_at || (l.last_contacted_at as string) < staleCutoff));
    for (const l of stale) {
      await sb.from("tasks").upsert(
        { org_id: ctx.orgId, lead_id: l.id, assignee_id: (l.owner_id as string | null) ?? ctx.ownerId, title: `Deal gone quiet: nudge ${l.name}`, description: `No contact for ${cfg.stale_days}+ days at the ${l.stage} stage. Offer the pilot, or ask if the timing changed.`, priority: "medium", due_at: now.toISOString(), dedupe_key: `stale:${l.id}:${week}` },
        { onConflict: "org_id,dedupe_key", ignoreDuplicates: true },
      );
    }

    // --- Compose ---------------------------------------------------------------
    const bySource = tally((newLeads.data ?? []).map((l) => String(l.source)));
    const replies = inbound.data ?? [];
    const intents = tally(replies.map((r) => (r.classification as { intent?: string } | null)?.intent ?? "unread"));
    const hot = replies.filter((r) => ["interested", "meeting_request", "question"].includes((r.classification as { intent?: string } | null)?.intent ?? ""));
    const stages = tally((openLeads.data ?? []).map((l) => String(l.stage)));
    const pipelineValue = (openLeads.data ?? []).reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0);

    const lines: string[] = [];
    lines.push(`Good morning! Here's ${formatIst(now.toISOString(), { weekday: "long", day: "numeric", month: "long" })}.`, "");
    lines.push("YESTERDAY");
    lines.push(`• New leads: ${newLeads.data?.length ?? 0}${Object.keys(bySource).length ? ` (${fmt(bySource)})` : ""}`);
    lines.push(`• Messages sent: ${emailsSent}`);
    lines.push(`• Replies: ${replies.length}${Object.keys(intents).length ? ` (${fmt(intents)})` : ""}`);
    lines.push(`• Meetings booked: ${meetingsBooked}`, "");
    lines.push("TODAY");
    const mt = meetingsToday.data ?? [];
    lines.push(`• Meetings: ${mt.length}`);
    for (const m of mt) lines.push(`   ${formatIst(m.starts_at as string, { hour: "numeric", minute: "2-digit" })} — ${name(m.lead_id as string | null)}${m.meet_url ? ` — ${m.meet_url}` : ""}`);
    lines.push(`• Tasks due or overdue: ${tasksDue}`);
    lines.push(`• Messages waiting for your approval: ${approvals}${approvals && site ? ` → ${site}/outreach` : ""}`);
    if (stale.length) lines.push(`• Deals gone quiet: ${stale.length} (nudge tasks created)`);
    lines.push("");
    if (hot.length) {
      lines.push("🔥 HOT REPLIES");
      for (const h of hot.slice(0, 8)) lines.push(`• ${name(h.lead_id as string | null)} (${h.channel}): “${String(h.body).replace(/\s+/g, " ").slice(0, 140)}”${site ? ` → ${site}/leads/${h.lead_id}` : ""}`);
      lines.push("");
    }
    lines.push("PIPELINE");
    lines.push(`• ${fmt(stages) || "empty"} · open value ₹${pipelineValue.toLocaleString("en-IN")}`, "");

    let weekly = false;
    if (new Date(now.getTime() + 5.5 * 3_600_000).getUTCDay() === cfg.weekly_day) {
      weekly = true;
      const perf = await outreachPerformance(sb, ctx.orgId, 7);
      lines.push("WEEKLY: WHAT'S WORKING (last 7 days)");
      lines.push(`• ${perf.sent} messages sent, ${perf.replied} people replied (${pct(perf.replied, perf.sent)})`);
      for (const s of perf.steps.filter((x) => x.channel !== "linkedin").slice(0, 8)) lines.push(`   ${s.label}: ${s.replies}/${s.sent} replied (${pct(s.replies, s.sent)}), ${s.positive} positive`);
      if (perf.variants.length) {
        lines.push("• Subject line A/B:");
        for (const v of perf.variants) lines.push(`   ${v.label} ${v.variant}: ${v.replies}/${v.sent} (${pct(v.replies, v.sent)})${v.example ? ` e.g. “${v.example}”` : ""}`);
      }
      lines.push("");
    }

    if (isAiConfigured()) {
      try {
        const f = await extract(
          focus,
          `${COMPANY_KNOWLEDGE}\n\n# Your job\nYou read today's sales brief for Creative Cut's founder and return exactly 3 short, concrete priorities for today (who to call or reply to first, what to unblock). No fluff.`,
          lines.join("\n"),
          800,
        );
        lines.splice(2, 0, "FOCUS TODAY", ...f.bullets.slice(0, 3).map((b) => `• ${b}`), "");
      } catch {
        // The brief still goes out without the focus section.
      }
    }
    if (site) lines.push(`Open the CRM: ${site}/dashboard`);

    let delivered = false;
    if (cfg.to && gmail.isConfigured()) {
      await gmail.send({ to: cfg.to, subject: `${weekly ? "📊 Weekly report + " : "☀️ "}Daily brief — ${mt.length} meeting${mt.length === 1 ? "" : "s"}, ${hot.length} hot repl${hot.length === 1 ? "y" : "ies"}, ${approvals} to approve`, text: lines.join("\n") });
      delivered = true;
    }
    return {
      status: "success",
      summary: `${delivered ? `Brief emailed to ${cfg.to}` : "Brief prepared (connect Gmail to email it)"}: ${newLeads.data?.length ?? 0} new leads, ${replies.length} replies, ${mt.length} meetings today, ${stale.length} stale deals flagged${weekly ? ", weekly report included" : ""}.`,
      created: stale.length,
      updated: 0,
    };
  },
});

function tally(values: string[]) {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

function fmt(t: Record<string, number>) {
  return Object.entries(t)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
    .join(", ");
}

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "—";
}
