import "server-only";

import { buildConnections } from "./connections";
import { istParts } from "./schedule";
import { agentEnv, readTab } from "./google-cloud";
import { WEEKDAYS, type AgentSnapshot, type ApiProvider, type ApiSlot, type Attention, type ConnectionStatus, type Draft, type DraftStatus, type Lead, type Mode, type RunRecord, type Schedule, type Sender, type Weekday } from "./types";

// Reads the live Google Sheet (same tabs the worker writes) into one snapshot.

const QUEUE_STATUS: Record<string, DraftStatus> = {
  DRAFT: "awaiting_approval", AWAITING_APPROVAL: "awaiting_approval", NEEDS_REVIEW: "needs_review", READY: "ready", APPROVED: "approved",
  SENDING: "sending", SENT: "sent", REPLIED: "replied", BOUNCED: "bounced", OPTED_OUT: "opted_out", SKIPPED: "skipped", FAILED: "failed",
};

export function settingsMap(rows: Record<string, string>[]) {
  return Object.fromEntries(rows.filter((r) => r.Key).map((r) => [r.Key!, (r.Value ?? "").trim()]));
}

const flag = (v: string | undefined) => ["TRUE", "YES", "1", "ON"].includes((v ?? "").toUpperCase());

export function scheduleFrom(s: Record<string, string>): Schedule {
  const times = (s.SCHEDULE_TIMES || [s.RUN_TIME_1, s.RUN_TIME_2].filter(Boolean).join(",")).split(",").map((t) => t.trim()).filter(Boolean)
    .map((t) => t.replace(/^(\d{1,2}):(\d{2}).*$/, (_, h, m) => `${String(h).padStart(2, "0")}:${m}`));
  const days = (s.SCHEDULE_DAYS || WEEKDAYS.join(",")).split(",").map((d) => d.trim()).filter((d): d is Weekday => (WEEKDAYS as string[]).includes(d));
  const win = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(s.SEND_WINDOW || "");
  return { times, days, oneTime: s.SCHEDULE_ONE_TIME || null, sendWindow: win ? { start: win[1]!, end: win[2]! } : null, paused: flag(s.SCHEDULE_PAUSED), timezone: "Asia/Kolkata" };
}

function plainProblem(err: string): string | null {
  if (!err) return null;
  const e = err.toLowerCase();
  if (e.includes("no verified portfolio sample")) return "No matching portfolio video on creativecut.in for this kind of work. Add a sample or edit the email.";
  if (e.includes("staffing intermediary")) return "Posted by a recruitment agency for an unnamed client, so this address may not reach the brand.";
  if (e.includes("email verification")) return "We couldn't confirm this email address can receive mail.";
  if (e.includes("could not be sourced") || e.includes("sourced")) return "The opening line couldn't be backed by the post. Check the wording.";
  if (e.includes("placeholder")) return "The email still has a blank to fill in.";
  if (e.includes("duplicate")) return "You've already contacted this person or company.";
  if (e.includes("suppression")) return "This address is on your do-not-contact list.";
  return err.length > 140 ? `${err.slice(0, 140)}…` : err;
}

const ROLE_LABEL: Record<string, string> = {
  "short form": "short-form video editor", "talking head": "talking-head video editor", podcast: "podcast editor", "saas demo": "product demo video",
  "motion graphics": "motion designer", "ad creative": "ad creative editor", "long form": "long-form YouTube editor", "real estate": "real estate video editor",
};

export function reasonFrom(l: Record<string, string>): string {
  const [titlePart, deliverable] = (l["Exact Need"] || "").includes(" — ") ? (l["Exact Need"] || "").split(" — ") : ["", l["Exact Need"] || ""];
  const title = (titlePart ?? "").replace(/^[^\p{L}\p{N}]+/u, "").replace(/^((urgent\s+)?(we'?re\s+)?hiring)\s*[:|!\-–]*\s*/i, "").replace(/^\W*\[?hiring\]?\W*/i, "").replace(/\s*:\s*r\/\w+$/i, "").replace(/\s*\.\.\.$/, "").trim();
  const who = l.Niche && !["Other", ""].includes(l.Niche) ? `${l.Niche} ${l.Niche === "Agency" ? "" : "brand "}`.replace("Coaches & creators brand", "Creator") : "";
  const where = l.Market ? ` · ${l.Market}` : "";
  if (title && title.length <= 70) return `${who ? `${who.trim()} hiring` : "Hiring"}: ${title}${where}`;
  const eng = (l.Engagement || "").toLowerCase();
  const engWord = ["freelance", "contract", "part-time"].includes(eng) ? `${eng} ` : "";
  const role = ROLE_LABEL[(deliverable || "").trim()] ?? "video editor";
  const art = /^[aeiou]/i.test(engWord || role) ? "an" : "a";
  return `${who ? `${who.trim()} looking` : "Looking"} for ${art} ${engWord}${role}${where}`;
}

function todayIst(now: Date) {
  const p = istParts(now);
  return `${p.y}-${String(p.mo + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function sendersFrom(s: Record<string, string>, queue: Record<string, string>[], today: string): Sender[] {
  return ([1, 2, 3] as const).map((slot) => {
    const email = s[`SENDER_${slot}_EMAIL`] || (slot === 1 ? s.SENDER_EMAIL || "" : "");
    const status = (s[`SENDER_${slot}_STATUS`] || (email ? "connected" : "setup_required")) as ConnectionStatus;
    const cap = Number(s[`SENDER_${slot}_DAILY_CAP`] || (slot === 1 ? s.DAILY_SEND_CAP : "") || 10);
    const sentToday = queue.filter((q) => (q.Sender || s.SENDER_EMAIL) === email && (q["Sent At"] || "").startsWith(today)).length;
    const warmOn = !["FALSE", "NO", "0", "OFF"].includes((s.WARMUP_ENABLED || "TRUE").toUpperCase());
    const warm = s[`SENDER_${slot}_WARM_DATE`] === today && /^\d+$/.test(s[`SENDER_${slot}_WARM_LIMIT`] || "") ? Number(s[`SENDER_${slot}_WARM_LIMIT`]) : 5;
    return { slot, email: email || null, status: email ? status : "setup_required", dailyCap: cap, sentToday, warmLimit: warmOn ? warm : null };
  });
}

function apiSlotsFrom(s: Record<string, string>): ApiSlot[] {
  const slot3: ApiProvider = (s.API_SLOT3_PROVIDER || "vibe").toLowerCase() === "bettercontact" ? "bettercontact" : "vibe";
  return (["web_research", "apollo", slot3] as ApiProvider[]).map((p, i) => {
    const k = (x: string) => s[`API_${p.toUpperCase()}_${x}`] || "";
    // Web Research is wired at deploy time (APIFY_TOKEN), so it counts as connected unless a check failed.
    const status = (k("STATUS") || (p === "web_research" ? "connected" : "setup_required")) as ConnectionStatus;
    return { slot: (i + 1) as 1 | 2 | 3, provider: p, status, hint: k("HINT") || null, usage: k("USAGE") || null, checkedAt: k("CHECKED") || null, error: k("ERROR") || null };
  });
}

function runsFrom(log: Record<string, string>[]): RunRecord[] {
  const groups = new Map<string, Record<string, string>[]>();
  for (const r of log) {
    const id = (r["Run ID"] || "").split("/")[0]!;
    if (!id) continue;
    groups.set(id, [...(groups.get(id) ?? []), r]);
  }
  const out: RunRecord[] = [];
  for (const [id, rows] of groups) {
    const sum = rows.find((r) => (r.Source || "").startsWith("ALL")) ?? rows.find((r) => !(r["Run ID"] || "").includes("/")) ?? rows[0]!;
    const st = (sum["Apify Status"] || "").toUpperCase();
    out.push({
      id, startedAt: sum.Started || "", finishedAt: sum.Finished || null, trigger: sum.Trigger || "", mode: sum.Mode === "LIVE" ? "LIVE" : "PREVIEW",
      result: st === "RUNNING" ? "running" : st === "SKIPPED" ? "skipped" : st.includes("ERROR") || Number(sum.Errors || 0) > 0 ? "with_errors" : "succeeded",
      found: Number(sum["Rows Found"] || 0), qualified: Number(sum.Qualified || 0), drafted: Number(sum.Ready || 0), sent: Number(sum.Sent || 0), skipped: Number(sum.Skipped || 0),
      costUsd: rows.reduce((a, r) => a + (Number(r["Cost USD"]) || 0), 0) / (rows.length > 1 ? 2 : 1),
      summary: (sum.Notes || "").split(" | errors:")[0]!.slice(0, 220),
      diagnostics: rows.filter((r) => r !== sum).map((r) => `${r.Source}: Apify run ${r["Apify Run ID"] || "—"} ${r["Apify Status"]}, ${r["Rows Found"] || 0} rows, $${r["Cost USD"] || "0"}${r.Notes ? ` — ${r.Notes}` : ""}`).concat(sum.Notes?.includes("errors:") ? [sum.Notes.split("errors:")[1]!.trim()] : []),
    });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function attentionFrom(s: Pick<AgentSnapshot, "apiSlots" | "senders" | "runs" | "sendingLive">): Attention | null {
  const names: Record<ApiProvider, string> = { web_research: "Web Research", apollo: "Apollo", vibe: "Vibe Prospecting", bettercontact: "BetterContact" };
  const broken = s.apiSlots.find((a) => a.status === "needs_reconnect");
  if (broken) return { message: `${names[broken.provider]} needs reconnecting`, fix: broken.error ? `${broken.error} Lookups through ${names[broken.provider]} are skipped until it's fixed.` : `Paste a fresh key to turn ${names[broken.provider]} back on.`, actionLabel: "Reconnect", href: `/agent/settings?open=${broken.provider}` };
  const sender = s.senders.find((x) => x.status === "needs_reconnect");
  if (sender) return { message: `Gmail sender ${sender.email} needs reconnecting`, fix: "Google signed this address out, so nothing can be sent from it. Sign in again to resume.", actionLabel: "Reconnect", href: "/agent/settings?open=gmail" };
  if (s.sendingLive && !s.senders.some((x) => x.status === "connected")) return { message: "Live sending is on, but no Gmail sender is connected", fix: "Connect a Gmail address so approved emails can go out.", actionLabel: "Connect Gmail", href: "/agent/settings?open=gmail" };
  const last = s.runs.find((r) => r.result !== "running");
  if (last?.result === "with_errors") return { message: "The last run finished with a problem", fix: last.summary || "Some steps didn't complete. The details are in Activity.", actionLabel: "View Activity", href: "/agent/activity" };
  return null;
}

export async function sheetSnapshot(now: Date): Promise<AgentSnapshot> {
  const [settingsRows, leadRows, queueRows, logRows] = await Promise.all([readTab("Settings"), readTab("Leads"), readTab("Outreach Queue"), readTab("Run Log")]);
  return snapshotFromTabs({ settingsRows, leadRows, queueRows, logRows }, now, `https://docs.google.com/spreadsheets/d/${agentEnv.sheetId}/edit`);
}

type Rows = Record<string, string>[];

/** Pure: Sheet tabs → snapshot (unit-tested against real Sheet rows). */
export function snapshotFromTabs(t: { settingsRows: Rows; leadRows: Rows; queueRows: Rows; logRows: Rows }, now: Date, sheetUrl: string | null): AgentSnapshot {
  const { settingsRows, leadRows, queueRows, logRows } = t;
  const s = settingsMap(settingsRows);
  const today = todayIst(now);
  const queueByLead = new Map<string, Record<string, string>>();
  for (const q of queueRows) if (q["Lead ID"] && (q.Touch || "FIRST") === "FIRST") queueByLead.set(q["Lead ID"], q);

  const leads: Lead[] = leadRows.filter((l) => l["Lead ID"]).map((l) => {
    const q = queueByLead.get(l["Lead ID"]!);
    const draft: Draft | null = q
      ? {
          attemptId: q["Attempt ID"]!, to: q.Recipient || "", subject: q.Subject || "", body: q["Email Preview"] || "",
          sampleTitle: q["Sample Title"] || "", sampleUrl: q["Sample URL"] || "", sender: q.Sender || null,
          status: QUEUE_STATUS[(q.Status || "").toUpperCase()] ?? "needs_review", problem: plainProblem(q["Last Error"] || ""), sentAt: q["Sent At"] || null,
          edited: (q.Notes || "").includes("[edited]"),
        }
      : null;
    return {
      id: l["Lead ID"]!, person: l["Contact Name"] || "", company: l.Company || "", reason: reasonFrom(l), market: l.Market || "", niche: l.Niche || "",
      source: l.Source || "", sourceUrl: l["Source URL"] || "", website: l.Website || null, postDate: l["Post Date"] || null, excerpt: l["Post Excerpt"] || "", research: l["Brand Research Notes"] || "",
      contactChannel: l["Contact Channel"] || "", draft: draft ?? null, foundAt: l["First Seen"] || "",
    };
  });

  const senders = sendersFrom(s, queueRows, today);
  const apiSlots = apiSlotsFrom(s);
  const runs = runsFrom(logRows);
  const running = (s.RUN_STATE || "").toUpperCase() === "RUNNING";
  const sendingLive = flag(s.SENDING_ENABLED);
  const draftStatuses = leads.map((l) => l.draft?.status);
  const snap: AgentSnapshot = {
    backend: "sheet",
    demo: null,
    mode: ((s.AGENT_MODE || "REVIEW").toUpperCase() === "AUTO" ? "AUTO" : "REVIEW") as Mode,
    sendingLive,
    dailyCap: Number(s.DAILY_SEND_CAP || 10),
    run: { running, stage: running ? s.RUN_STAGE || "Working" : null, startedAt: running ? s.RUN_STARTED || null : null, progress: running && s.RUN_PROGRESS ? Number(s.RUN_PROGRESS) : null },
    schedule: scheduleFrom(s),
    today: {
      qualified: leadRows.filter((l) => (l["First Seen"] || "").startsWith(today) && !["SKIPPED", "CLOSED"].includes((l.Status || "").toUpperCase())).length,
      needsReview: draftStatuses.filter((x) => x === "awaiting_approval" || x === "needs_review").length,
      sent: queueRows.filter((q) => (q["Sent At"] || "").startsWith(today)).length,
    },
    leads,
    senders,
    apiSlots,
    connections: [],
    attention: null,
    runs,
    setup: {
      leadSource: apiSlots.some((a) => a.status === "connected"),
      sender: senders.some((x) => x.status === "connected"),
      previewRun: runs.some((r) => r.result !== "running"),
      mode: flag(s.MODE_CHOSEN),
    },
    sheetUrl,
    now: now.toISOString(),
  };
  snap.connections = buildConnections(snap);
  snap.attention = attentionFrom(snap);
  return snap;
}
