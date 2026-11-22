// Shared types for the Creative Cut Lead Agent UI (/agent).
// The Google Sheet "Creative Cut | Lead Generation & Outreach" is the source of
// truth; the Cloud Run worker (lead-engine/) and this UI both read and write it.

export type Mode = "AUTO" | "REVIEW";
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface Schedule {
  /** "HH:MM" 24h, Asia/Kolkata. Each one is a "Start research" time. */
  times: string[];
  days: Weekday[];
  /** Extra one-time run, "YYYY-MM-DD HH:MM" IST, or null. */
  oneTime: string | null;
  /** Emails only go out inside this window (IST). Research still runs. */
  sendWindow: { start: string; end: string } | null;
  paused: boolean;
  timezone: "Asia/Kolkata";
}

export type DraftStatus =
  | "awaiting_approval" // Review & Approve mode: ready, waiting for you
  | "needs_review" // something is missing (sample, contact, date…)
  | "ready" // Auto mode: will send on the next run (when live sending is on)
  | "approved" // you approved it; sends on the next run inside the send window
  | "sending"
  | "sent"
  | "replied"
  | "bounced"
  | "opted_out"
  | "skipped"
  | "failed"
  | "no_email"; // lead found, but they asked for a form/DM — nothing to send

export interface Draft {
  attemptId: string;
  to: string;
  subject: string;
  body: string;
  sampleTitle: string;
  sampleUrl: string;
  sender: string | null;
  status: DraftStatus;
  /** Plain-language reason a draft needs your attention. */
  problem: string | null;
  sentAt: string | null;
  edited: boolean;
}

export interface Lead {
  id: string;
  person: string;
  company: string;
  /** One short reason they qualified. */
  reason: string;
  market: string;
  niche: string;
  source: string;
  sourceUrl: string;
  postDate: string | null;
  excerpt: string;
  research: string;
  contactChannel: string;
  draft: Draft | null;
  foundAt: string;
}

export type ConnectionStatus = "connected" | "setup_required" | "needs_reconnect" | "checking";

export interface Sender {
  slot: 1 | 2 | 3;
  email: string | null;
  status: ConnectionStatus;
  dailyCap: number;
  sentToday: number;
  /** Warm-up allowance for today (null when warm-up is off). Sends left = min(dailyCap, warmLimit) - sentToday. */
  warmLimit: number | null;
}

export type ApiProvider = "web_research" | "apollo" | "vibe" | "bettercontact";

export interface ApiSlot {
  slot: 1 | 2 | 3;
  provider: ApiProvider;
  status: ConnectionStatus;
  /** Last 4 characters only, e.g. "••••3f9a". The key itself never reaches the browser. */
  hint: string | null;
  /** Balance or usage, when the provider reports it. */
  usage: string | null;
  checkedAt: string | null;
  error: string | null;
}

export interface Connection {
  key: ApiProvider | "gmail";
  name: string;
  /** What it is used for, in one line. */
  purpose: string;
  method: "API Key" | "Google sign-in" | "Direct Connection";
  status: ConnectionStatus;
  statusText: string;
  nextAction: string;
  details: { label: string; value: string }[];
}

export interface RunRecord {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  trigger: string;
  mode: "LIVE" | "PREVIEW";
  result: "succeeded" | "with_errors" | "skipped" | "running";
  found: number;
  qualified: number;
  drafted: number;
  sent: number;
  skipped: number;
  costUsd: number;
  summary: string;
  /** Technical diagnostics: per-source run IDs, errors. Shown only in Run History. */
  diagnostics: string[];
}

export interface RunState {
  running: boolean;
  /** One human-readable stage, e.g. "Checking contact details". */
  stage: string | null;
  startedAt: string | null;
  progress: number | null;
}

export interface Attention {
  message: string;
  fix: string;
  actionLabel: string;
  href: string;
}

export interface SetupProgress {
  leadSource: boolean;
  sender: boolean;
  previewRun: boolean;
  mode: boolean;
}

export interface AgentSnapshot {
  backend: "sheet" | "demo" | "snapshot";
  /** When backend is "snapshot": when the real data was captured. */
  snapshotAt?: string | null;
  demo: { scenario: DemoScenario; label: string } | null;
  mode: Mode;
  sendingLive: boolean;
  dailyCap: number;
  run: RunState;
  schedule: Schedule;
  today: { qualified: number; needsReview: number; sent: number };
  leads: Lead[];
  senders: Sender[];
  apiSlots: ApiSlot[];
  connections: Connection[];
  attention: Attention | null;
  runs: RunRecord[];
  setup: SetupProgress;
  sheetUrl: string | null;
  now: string;
}

export type DemoScenario = "setup" | "running" | "finished";
