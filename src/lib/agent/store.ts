import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { buildConnections } from "./connections";
import { demoSnapshot } from "./demo";
import { sheetConfigured } from "./google-cloud";
import { sheetSnapshot, snapshotFromTabs } from "./sheet-store";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentSnapshot, DemoScenario, Draft, Mode, Schedule } from "./types";

export const DEMO_COOKIE = "agent_demo";
const SCENARIOS: DemoScenario[] = ["setup", "running", "finished"];

/** Which data the UI shows: the live Sheet, or a labelled demo scenario. */
/** Real data captured from a live run, used read-only when the app has no Google credentials. */
export function liveSnapshot(): { takenAt: string; sheetUrl: string | null; tabs: Parameters<typeof snapshotFromTabs>[0] } | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "src/lib/agent/snapshot-data.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function currentSource(): Promise<{ backend: "sheet" | "demo" | "snapshot"; scenario: DemoScenario }> {
  const jar = await cookies();
  const v = jar.get(DEMO_COOKIE)?.value as DemoScenario | undefined;
  if (v && SCENARIOS.includes(v)) return { backend: "demo", scenario: v };
  if (sheetConfigured()) return { backend: "sheet", scenario: "finished" };
  return liveSnapshot() ? { backend: "snapshot", scenario: "finished" } : { backend: "demo", scenario: "finished" };
}

// ---- demo overlay: edits made while exploring demo data (kept in memory only)
interface DemoOverlay {
  drafts: Record<string, Partial<Draft>>;
  mode?: Mode;
  modeChosen?: boolean;
  schedule?: Schedule;
  sendingLive?: boolean;
  runRequested?: number;
}
const overlays = new Map<DemoScenario, DemoOverlay>();
export function demoOverlay(s: DemoScenario): DemoOverlay {
  if (!overlays.has(s)) overlays.set(s, { drafts: {} });
  return overlays.get(s)!;
}
export function resetDemo(s: DemoScenario) {
  overlays.delete(s);
}

/** One snapshot per request (layout and page share it). */
export const getSnapshot = cache(loadSnapshot);

async function loadSnapshot(): Promise<AgentSnapshot> {
  const now = new Date();
  const src = await currentSource();
  if (src.backend === "sheet") return sheetSnapshot(now);
  if (src.backend === "snapshot") {
    const snap = liveSnapshot()!;
    return { ...snapshotFromTabs(snap.tabs, now, snap.sheetUrl), backend: "snapshot", snapshotAt: snap.takenAt };
  }
  const snap = demoSnapshot(src.scenario, now);
  const o = demoOverlay(src.scenario);
  for (const lead of snap.leads) {
    if (lead.draft && o.drafts[lead.draft.attemptId]) lead.draft = { ...lead.draft, ...o.drafts[lead.draft.attemptId] };
  }
  if (o.mode) snap.mode = o.mode;
  if (o.modeChosen) snap.setup.mode = true;
  if (o.schedule) snap.schedule = o.schedule;
  if (o.sendingLive !== undefined) snap.sendingLive = o.sendingLive;
  if (o.runRequested && !snap.run.running && Date.now() - o.runRequested < 90_000) {
    snap.run = { running: true, stage: "Searching for new hiring posts", startedAt: new Date(o.runRequested).toISOString(), progress: 0.1 };
  }
  const st = snap.leads.map((l) => l.draft?.status);
  snap.today.needsReview = st.filter((x) => x === "awaiting_approval" || x === "needs_review").length;
  snap.connections = buildConnections(snap);
  return snap;
}
