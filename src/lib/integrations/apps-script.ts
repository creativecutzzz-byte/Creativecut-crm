import "server-only";

// Free Google connection without Google Cloud: a small Google Apps Script
// (docs/apps-script/Code.gs) deployed as a web app on the Gmail account.
// The CRM calls it with a shared secret. Used for the booking calendar and
// for sending alerts / the daily brief when no Workspace service account or
// OAuth connection is set up.

export function hasAppsScript() {
  return Boolean(process.env.GOOGLE_SCRIPT_URL && process.env.GOOGLE_SCRIPT_SECRET);
}

export async function appsScript<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(process.env.GOOGLE_SCRIPT_URL!, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret: process.env.GOOGLE_SCRIPT_SECRET, action, ...payload }),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: { ok?: boolean; error?: string; data?: T };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(`Google Apps Script returned an unexpected response (HTTP ${res.status}). Check the deployment URL and that access is "Anyone".`);
  }
  if (!json.ok) throw new Error(`Google Apps Script: ${json.error ?? "unknown error"}`);
  return json.data as T;
}
