import "server-only";

import { createHmac } from "node:crypto";

// Minimum Gmail scopes for a sender: send email, and read message headers to
// spot replies, bounces and opt-outs. Message bodies are never read.
export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.metadata"];

export function stateSecret() {
  return process.env.AGENT_STATE_SECRET || process.env.CRON_SECRET || "";
}

export function signState(slot: number, ts: number) {
  return createHmac("sha256", stateSecret()).update(`agent-gmail:${slot}.${ts}`).digest("base64url").slice(0, 32);
}
