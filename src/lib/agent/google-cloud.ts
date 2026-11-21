import "server-only";

import { createSign } from "node:crypto";
import { cronJobs } from "./schedule";
import type { Schedule } from "./types";

// Server-side access to Google Cloud for the Lead Agent, as the agent's service
// account (no user impersonation): Sheets (the source of truth), Cloud Run Jobs
// (Run Now), Cloud Scheduler (schedule) and Secret Manager (API keys, Gmail tokens).

export const agentEnv = {
  sheetId: process.env.AGENT_SHEET_ID || process.env.LEADS_SHEET_ID || "",
  saEmail: process.env.AGENT_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
  saKey: (process.env.AGENT_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "").replace(/\\n/g, "\n"),
  project: process.env.GOOGLE_CLOUD_PROJECT || "",
  region: process.env.GCP_REGION || "asia-south1",
  job: process.env.CLOUD_RUN_JOB || "creativecut-lead-engine",
  schedulerSa: process.env.SCHEDULER_SERVICE_ACCOUNT || "",
  schedulerPrefix: process.env.SCHEDULER_JOB_PREFIX || "creativecut-leads",
  gmailClientId: process.env.GMAIL_OAUTH_CLIENT_ID || "",
  gmailClientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET || "",
};

export const sheetConfigured = () => Boolean(agentEnv.sheetId && agentEnv.saEmail && agentEnv.saKey);
export const cloudConfigured = () => sheetConfigured() && Boolean(agentEnv.project);

const SCOPE = "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/spreadsheets";
let cached: { token: string; expires: number } | null = null;

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function token(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: agentEnv.saEmail, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(agentEnv.saKey);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !j.access_token) throw new Error(`Google Cloud sign-in failed: ${j.error_description ?? res.status}`);
  cached = { token: j.access_token, expires: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function gcp<T = unknown>(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; json: T }> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, json };
}

// ------------------------------------------------------------------ Sheets
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

export async function readTab(tab: string): Promise<Record<string, string>[]> {
  const r = await gcp<{ values?: string[][] }>(`${SHEETS}/${agentEnv.sheetId}/values/${encodeURIComponent(`'${tab}'!A1:AZ`)}`);
  if (!r.ok) throw new Error(`Couldn't read the ${tab} tab (HTTP ${r.status}). Share the Sheet with ${agentEnv.saEmail}.`);
  const [hdr = [], ...rows] = r.json.values ?? [];
  return rows.map((row, i) => Object.fromEntries([...hdr.map((h, j) => [h, row[j] ?? ""]), ["_row", String(i + 2)]]));
}

function col(n: number) {
  let s = "";
  n += 1;
  while (n) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Update specific cells of keyed rows. `changes` maps key value → {column: value}. */
export async function updateRows(tab: string, keyCol: string, changes: Record<string, Record<string, string>>) {
  const r = await gcp<{ values?: string[][] }>(`${SHEETS}/${agentEnv.sheetId}/values/${encodeURIComponent(`'${tab}'!A1:AZ`)}`);
  const [hdr = [], ...rows] = r.json.values ?? [];
  const keyIdx = hdr.indexOf(keyCol);
  const data: { range: string; values: string[][] }[] = [];
  const append: string[][] = [];
  for (const [key, cells] of Object.entries(changes)) {
    const i = rows.findIndex((row) => row[keyIdx] === key);
    if (i < 0) {
      append.push(hdr.map((h) => (h === keyCol ? key : cells[h] ?? "")));
      continue;
    }
    for (const [c, v] of Object.entries(cells)) {
      const j = hdr.indexOf(c);
      if (j >= 0) data.push({ range: `'${tab}'!${col(j)}${i + 2}`, values: [[v]] });
    }
  }
  if (data.length) {
    const u = await gcp(`${SHEETS}/${agentEnv.sheetId}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
    if (!u.ok) throw new Error(`Couldn't save to the ${tab} tab (HTTP ${u.status}).`);
  }
  if (append.length) {
    const a = await gcp(`${SHEETS}/${agentEnv.sheetId}/values/${encodeURIComponent(`'${tab}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: append }) });
    if (!a.ok) throw new Error(`Couldn't add to the ${tab} tab (HTTP ${a.status}).`);
  }
}

export async function setSettings(values: Record<string, string>) {
  await updateRows("Settings", "Key", Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { Value: v }])));
}

// ------------------------------------------------------------------ Cloud Run
export async function startJob(trigger: string): Promise<string> {
  const url = `https://run.googleapis.com/v2/projects/${agentEnv.project}/locations/${agentEnv.region}/jobs/${agentEnv.job}:run`;
  const r = await gcp<{ name?: string; error?: { message?: string } }>(url, {
    method: "POST",
    body: JSON.stringify({ overrides: { containerOverrides: [{ args: ["run", "--trigger", trigger] }] } }),
  });
  if (!r.ok) throw new Error(r.json.error?.message ?? `Couldn't start the run (HTTP ${r.status}).`);
  return r.json.name ?? "";
}

// ------------------------------------------------------------------ Scheduler
const SCHED = "https://cloudscheduler.googleapis.com/v1";

/** Make Cloud Scheduler match the schedule, then read it back. Returns the verified job list. */
export async function syncScheduler(s: Schedule): Promise<string[]> {
  const parent = `projects/${agentEnv.project}/locations/${agentEnv.region}`;
  const want = cronJobs(s).map((j) => ({ ...j, name: `${parent}/jobs/${agentEnv.schedulerPrefix}-${j.id}` }));
  const list = await gcp<{ jobs?: { name: string; schedule?: string; state?: string }[] }>(`${SCHED}/${parent}/jobs?pageSize=100`);
  const existing = (list.json.jobs ?? []).filter((j) => j.name.split("/").pop()!.startsWith(`${agentEnv.schedulerPrefix}-`));
  const target = {
    uri: `https://run.googleapis.com/v2/${parent}/jobs/${agentEnv.job}:run`,
    httpMethod: "POST",
    oauthToken: { serviceAccountEmail: agentEnv.schedulerSa, scope: "https://www.googleapis.com/auth/cloud-platform" },
  };
  for (const old of existing) if (!want.some((w) => w.name === old.name)) await gcp(`${SCHED}/${old.name}`, { method: "DELETE" });
  for (const w of want) {
    const body = { name: w.name, schedule: w.cron, timeZone: s.timezone, description: "Creative Cut Lead Agent: Start research (managed from the agent's Schedule page)", httpTarget: target };
    const has = existing.find((e) => e.name === w.name);
    const r = has
      ? await gcp(`${SCHED}/${w.name}?updateMask=schedule,timeZone,description,httpTarget`, { method: "PATCH", body: JSON.stringify(body) })
      : await gcp(`${SCHED}/${parent}/jobs`, { method: "POST", body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Couldn't save the schedule to Google Cloud (HTTP ${r.status}).`);
    await gcp(`${SCHED}/${w.name}:${s.paused ? "pause" : "resume"}`, { method: "POST", body: "{}" });
  }
  const verified: string[] = [];
  for (const w of want) {
    const back = await gcp<{ schedule?: string; timeZone?: string; state?: string }>(`${SCHED}/${w.name}`);
    const ok = back.json.schedule === w.cron && back.json.timeZone === s.timezone && (s.paused ? back.json.state === "PAUSED" : back.json.state === "ENABLED");
    if (!ok) throw new Error(`Google Cloud didn't keep the schedule for ${w.id}. Nothing was changed on your side; try again.`);
    verified.push(`${w.id}: ${w.cron} ${s.timezone} ${back.json.state}`);
  }
  return verified;
}

// ------------------------------------------------------------------ Secrets
const SM = "https://secretmanager.googleapis.com/v1";

export async function putSecret(name: string, value: string) {
  const base = `${SM}/projects/${agentEnv.project}/secrets`;
  const exists = await gcp(`${base}/${name}`);
  if (exists.status === 404) {
    const c = await gcp(`${base}?secretId=${name}`, { method: "POST", body: JSON.stringify({ replication: { automatic: {} } }) });
    if (!c.ok) throw new Error(`Couldn't create secure storage for this key (HTTP ${c.status}).`);
  }
  const v = await gcp(`${base}/${name}:addVersion`, { method: "POST", body: JSON.stringify({ payload: { data: Buffer.from(value).toString("base64") } }) });
  if (!v.ok) throw new Error(`Couldn't store the key securely (HTTP ${v.status}).`);
}

export async function getSecret(name: string): Promise<string | null> {
  const r = await gcp<{ payload?: { data?: string } }>(`${SM}/projects/${agentEnv.project}/secrets/${name}/versions/latest:access`);
  return r.ok && r.json.payload?.data ? Buffer.from(r.json.payload.data, "base64").toString("utf8") : null;
}

export async function disableSecret(name: string) {
  const r = await gcp(`${SM}/projects/${agentEnv.project}/secrets/${name}/versions/latest:disable`, { method: "POST", body: "{}" });
  return r.ok;
}
