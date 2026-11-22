"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { canChangeLive } from "@/lib/agent/access";
import { agentEnv, cloudConfigured, disableSecret, putSecret, setSettings, startJob, syncScheduler, updateRows } from "@/lib/agent/google-cloud";
import { checkKey, SECRET_NAME } from "@/lib/agent/providers";
import { describeSchedule, nextRuns, formatRelative, sortTimes, validateSchedule } from "@/lib/agent/schedule";
import { currentSource, DEMO_COOKIE, demoOverlay, getSnapshot, resetDemo } from "@/lib/agent/store";
import type { ApiProvider, DemoScenario, Mode, Schedule } from "@/lib/agent/types";

export interface ActionResult {
  ok: boolean;
  message: string;
}

const done = (message: string): ActionResult => {
  revalidatePath("/agent", "layout");
  return { ok: true, message };
};
const fail = (message: string): ActionResult => ({ ok: false, message });

/** Live data may only be changed by workspace owners/admins (demo data by anyone). */
async function guard(): Promise<{ demo: DemoScenario | null; error?: ActionResult }> {
  const src = await currentSource();
  if (src.backend === "demo") return { demo: src.scenario };
  const access = await canChangeLive();
  return access.ok ? { demo: null } : { demo: null, error: fail(access.reason!) };
}

async function run(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong. Please try again.");
  }
}

// ---------------------------------------------------------------- demo
export async function chooseDemo(scenario: DemoScenario | "live"): Promise<void> {
  const jar = await cookies();
  if (scenario === "live") jar.delete(DEMO_COOKIE);
  else {
    resetDemo(scenario);
    jar.set(DEMO_COOKIE, scenario, { path: "/agent", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  }
  revalidatePath("/agent", "layout");
}

// ---------------------------------------------------------------- runs
export async function runNow(): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    if (g.demo) {
      demoOverlay(g.demo).runRequested = Date.now();
      return done("Demo: a run would start now. You can close this page; it keeps going.");
    }
    const snap = await getSnapshot();
    if (snap.run.running) return fail("A run is already in progress.");
    if (!cloudConfigured()) return fail("The agent's Google Cloud connection isn't set up yet, so it can't start a run from here.");
    await setSettings({ RUN_STATE: "RUNNING", RUN_STAGE: "Starting", RUN_STARTED: new Date().toISOString() });
    await startJob("run-now");
    return done("Run started. You can close this page — it keeps going in the background.");
  });
}

// ---------------------------------------------------------------- mode & sending
export async function setMode(mode: Mode): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    const label = mode === "AUTO" ? "Auto" : "Review & Approve";
    if (g.demo) {
      Object.assign(demoOverlay(g.demo), { mode, modeChosen: true });
      return done(`Mode set to ${label} (demo).`);
    }
    await setSettings({ AGENT_MODE: mode, MODE_CHOSEN: "TRUE" });
    return done(`Mode set to ${label}.`);
  });
}

export async function setSending(on: boolean): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    if (g.demo) {
      demoOverlay(g.demo).sendingLive = on;
      return done(on ? "Live sending on (demo)." : "Preview only (demo).");
    }
    if (on) {
      const snap = await getSnapshot();
      if (!snap.senders.some((s) => s.status === "connected")) return fail("Connect a Gmail sender before turning on live sending.");
    }
    await setSettings({ SENDING_ENABLED: on ? "TRUE" : "FALSE" });
    return done(on ? "Live sending is on. Eligible emails go out on the next run." : "Preview only. Nothing will be sent.");
  });
}

// ---------------------------------------------------------------- drafts
const PLACEHOLDER = /\[[^\]]{2,}\]|\{[a-z_]+\}|\bTODO\b|\bXXX\b/;

export async function approveDrafts(attemptIds: string[]): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    if (!attemptIds.length) return fail("Nothing selected.");
    const snap = await getSnapshot();
    const drafts = snap.leads.map((l) => l.draft).filter((d) => d && attemptIds.includes(d.attemptId));
    const blocked = drafts.filter((d) => d!.status === "needs_review" && d!.problem?.includes("blank"));
    if (blocked.length) return fail(`${blocked.length} draft${blocked.length > 1 ? "s still have" : " still has"} a blank to fill in.`);
    const n = drafts.length;
    const when = snap.sendingLive ? "They'll go out on the next run" : "Live sending is off, so they'll wait until you turn it on";
    if (g.demo) {
      for (const d of drafts) demoOverlay(g.demo).drafts[d!.attemptId] = { status: "approved" };
      return done(`Approved ${n} email${n === 1 ? "" : "s"} (demo). ${when}.`);
    }
    await updateRows("Outreach Queue", "Attempt ID", Object.fromEntries(drafts.map((d) => [d!.attemptId, { Status: "APPROVED" }])));
    return done(`Approved ${n} email${n === 1 ? "" : "s"}. ${when}.`);
  });
}

export async function skipDraft(attemptId: string): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    if (g.demo) {
      demoOverlay(g.demo).drafts[attemptId] = { status: "skipped" };
      return done("Skipped (demo). This person won't be emailed.");
    }
    await updateRows("Outreach Queue", "Attempt ID", { [attemptId]: { Status: "SKIPPED", "Last Error": "Skipped by you" } });
    return done("Skipped. This person won't be emailed.");
  });
}

export async function saveDraft(attemptId: string, subject: string, body: string, sender: string | null): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    subject = subject.trim();
    body = body.replace(/\r\n/g, "\n").trim();
    if (!subject || subject.length > 150) return fail("Add a subject line (up to 150 characters).");
    if (body.length < 40 || body.length > 4000) return fail("The email should be between 40 and 4,000 characters.");
    if (PLACEHOLDER.test(subject) || PLACEHOLDER.test(body)) return fail("Fill in the part in [brackets] before saving.");
    if (!/creativecut\.in/.test(body)) return fail("Keep the “Creative Cut (https://creativecut.in)” signature line.");
    if (g.demo) {
      demoOverlay(g.demo).drafts[attemptId] = { subject, body, sender, edited: true };
      return done("Saved (demo).");
    }
    await updateRows("Outreach Queue", "Attempt ID", { [attemptId]: { Subject: subject, "Email Preview": body, Sender: sender ?? "", Notes: "[edited] in the Lead Agent" } });
    return done("Saved. The email will be sent exactly as written.");
  });
}

// ---------------------------------------------------------------- schedule
export async function saveSchedule(input: Schedule): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    const s: Schedule = { ...input, times: sortTimes(input.times), timezone: "Asia/Kolkata" };
    const err = validateSchedule(s, new Date());
    if (err) return fail(err);
    const next = nextRuns(s, new Date(), 1)[0];
    const nextText = next ? ` Next: Start research ${formatRelative(next, new Date())} IST.` : "";
    if (g.demo) {
      demoOverlay(g.demo).schedule = s;
      return done(`Saved (demo): ${describeSchedule(s)}.${nextText}`);
    }
    await setSettings({
      SCHEDULE_TIMES: s.times.join(","), SCHEDULE_DAYS: s.days.join(","), SCHEDULE_ONE_TIME: s.oneTime ?? "",
      SEND_WINDOW: s.sendWindow ? `${s.sendWindow.start}-${s.sendWindow.end}` : "", SCHEDULE_PAUSED: s.paused ? "TRUE" : "FALSE",
      RUN_TIME_1: s.times[0] ?? "", RUN_TIME_2: s.times[1] ?? "",
    });
    if (!cloudConfigured()) return done(`Saved: ${describeSchedule(s)}. The background schedule updates on the next run.${nextText}`);
    await syncScheduler(s);
    return done(`Saved and confirmed with Google Cloud: ${describeSchedule(s)}.${nextText}`);
  });
}

// ---------------------------------------------------------------- connections
export async function saveApiKey(provider: ApiProvider, key: string): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    key = key.trim();
    if (key.length < 12 || /\s/.test(key)) return fail("That doesn't look like a complete key. Copy it again and paste the whole thing.");
    if (g.demo) return done("Demo: in the live app the key is checked with the provider and stored in Google Secret Manager.");
    const check = await checkKey(provider, key);
    const P = provider.toUpperCase();
    if (!check.ok) {
      return fail(check.error ?? "The key didn't work.");
    }
    if (!cloudConfigured()) return fail("The agent's Google Cloud connection isn't set up, so the key can't be stored securely yet.");
    await putSecret(SECRET_NAME[provider], key);
    await setSettings({ [`API_${P}_STATUS`]: "connected", [`API_${P}_HINT`]: `••••${key.slice(-4)}`, [`API_${P}_USAGE`]: check.usage ?? "", [`API_${P}_CHECKED`]: new Date().toISOString(), [`API_${P}_ERROR`]: "" });
    return done(`Connected. ${check.usage ?? "The key works."}`);
  });
}

export async function removeApiKey(provider: ApiProvider): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    if (g.demo) return done("Removed (demo).");
    const P = provider.toUpperCase();
    if (cloudConfigured()) await disableSecret(SECRET_NAME[provider]);
    await setSettings({ [`API_${P}_STATUS`]: "setup_required", [`API_${P}_HINT`]: "", [`API_${P}_USAGE`]: "", [`API_${P}_ERROR`]: "" });
    return done("Disconnected. The agent will stop using it from the next run.");
  });
}

/** Credential slot 3 can hold Vibe Prospecting (shuts down 2 Dec 2026) or BetterContact. */
export async function setSlot3Provider(provider: "vibe" | "bettercontact"): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    const name = provider === "bettercontact" ? "BetterContact" : "Vibe Prospecting";
    if (g.demo) return done(`Slot 3 now uses ${name} (demo).`);
    await setSettings({ API_SLOT3_PROVIDER: provider });
    return done(`Slot 3 now uses ${name}. Add its API key to turn it on.`);
  });
}

export async function setSenderCap(slot: 1 | 2 | 3, cap: number): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    if (!Number.isInteger(cap) || cap < 1 || cap > 50) return fail("Pick a daily limit between 1 and 50.");
    if (g.demo) return done(`Daily limit set to ${cap} (demo).`);
    await setSettings({ [`SENDER_${slot}_DAILY_CAP`]: String(cap) });
    return done(`Sender ${slot} can send up to ${cap} first emails a day.`);
  });
}

export async function disconnectSender(slot: 1 | 2 | 3): Promise<ActionResult> {
  return run(async () => {
    const g = await guard();
    if (g.error) return g.error;
    if (g.demo) return done("Disconnected (demo).");
    if (cloudConfigured()) await disableSecret(`GMAIL_SENDER_${slot}_REFRESH_TOKEN`);
    await setSettings({ [`SENDER_${slot}_EMAIL`]: "", [`SENDER_${slot}_STATUS`]: "setup_required", ...(slot === 1 ? { SENDER_EMAIL: "" } : {}) });
    return done(`Sender ${slot} disconnected.`);
  });
}

export async function gmailReady() {
  return Boolean(agentEnv.gmailClientId && agentEnv.gmailClientSecret);
}
