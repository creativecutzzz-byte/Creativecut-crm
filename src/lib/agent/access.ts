import "server-only";

import { getViewer } from "@/lib/data";

/**
 * Who may change LIVE Lead Agent data: signed-in workspace owners/admins.
 * Without CRM sign-in (Supabase not configured), live changes are refused
 * unless the host is already access-controlled and says so with
 * AGENT_TRUSTED_ACCESS=true (e.g. Netlify team login in front of the site).
 */
export async function canChangeLive(): Promise<{ ok: boolean; reason?: string }> {
  const viewer = await getViewer();
  if (viewer.mode === "live") {
    return ["owner", "admin"].includes(viewer.role) ? { ok: true } : { ok: false, reason: "Only workspace owners and admins can change the Lead Agent." };
  }
  if (process.env.AGENT_TRUSTED_ACCESS === "true") return { ok: true };
  return { ok: false, reason: "Sign-in isn't set up for this app, so live changes are switched off. Turn on CRM sign-in, or set AGENT_TRUSTED_ACCESS=true if the site is already behind a login." };
}
