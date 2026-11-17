import "server-only";

import { getViewer } from "@/lib/data";

// Who may open the Outreach Engine dashboard and its API: signed-in owners and
// admins whose email is on ALLOWED_LOGIN_DOMAIN (comma-separated list allowed),
// e.g. "creativecut.in". The dashboard shows lead data and replies, so it is
// never public.

export function emailDomainAllowed(email: string | null | undefined, allowed = process.env.ALLOWED_LOGIN_DOMAIN) {
  if (!allowed) return true;
  const domain = (email ?? "").toLowerCase().split("@")[1];
  return Boolean(domain) && allowed.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean).includes(domain!);
}

export async function engineAccess(): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const viewer = await getViewer();
  if (viewer.mode !== "live" || !viewer.userId) return { ok: false, reason: "Sign in to open the outreach engine." };
  if (!["owner", "admin"].includes(viewer.role)) return { ok: false, reason: "Only workspace owners and admins can open the outreach engine." };
  if (!emailDomainAllowed(viewer.email)) return { ok: false, reason: `Sign in with your ${process.env.ALLOWED_LOGIN_DOMAIN} Google Workspace account to open the outreach engine.` };
  return { ok: true, email: viewer.email };
}
