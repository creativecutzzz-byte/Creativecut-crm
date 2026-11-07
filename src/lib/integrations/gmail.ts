import "server-only";

import { b64url, googleAccessToken, hasGoogleAccess, hasOAuthAccount, oauthEmail } from "./google";
import { hasCredentials, isMessagingLive } from "./safety";

// Gmail through Google Workspace: a service account with domain-wide
// delegation acts as the outreach mailbox (GMAIL_SENDER). Setup:
// docs/google-workspace-setup.md.
//
// Scope: gmail.modify (send + read replies). Sending also requires
// MESSAGING_MODE=live; reading replies does not.

const KEYS = ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_KEY", "GMAIL_SENDER"] as const;
const SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const gmail = {
  envKeys: KEYS,

  isConfigured() {
    return hasGoogleAccess() && Boolean(this.sender());
  },

  /** Reading replies needs the Workspace service account (gmail.modify); a connected @gmail.com only sends. */
  canRead() {
    return hasCredentials(...KEYS);
  },

  isLive() {
    return isMessagingLive() && this.isConfigured();
  },

  sender() {
    return process.env.GMAIL_SENDER || (hasOAuthAccount() ? oauthEmail() : "");
  },

  senderName() {
    return process.env.GMAIL_SENDER_NAME ?? "";
  },

  async send(input: SendInput): Promise<{ id: string; threadId: string; messageId: string | null }> {
    const raw = buildMime(input, this.sender(), this.senderName());
    const sent = await api<{ id: string; threadId: string }>("messages/send", { method: "POST", body: { raw, ...(input.threadId ? { threadId: input.threadId } : {}) } });
    const meta = await api<GmailMessage>(`messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`).catch(() => null);
    return { id: sent.id, threadId: sent.threadId, messageId: header(meta, "Message-ID") };
  },

  /** Inbox messages not sent by us, newest first. */
  async listInbox(newerThanDays: number, max = 50) {
    const q = encodeURIComponent(`in:inbox -from:me newer_than:${newerThanDays}d`);
    const res = await api<{ messages?: { id: string; threadId: string }[] }>(`messages?q=${q}&maxResults=${max}`);
    return res.messages ?? [];
  },

  async getMessage(id: string): Promise<InboundEmail> {
    const msg = await api<GmailMessage>(`messages/${id}?format=full`);
    const from = header(msg, "From") ?? "";
    return {
      id: msg.id,
      threadId: msg.threadId,
      from,
      fromEmail: (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase(),
      subject: header(msg, "Subject") ?? "",
      messageId: header(msg, "Message-ID"),
      date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString(),
      text: stripQuoted(plainText(msg.payload) || msg.snippet || ""),
      isAutoReply: /auto-replied|auto-generated/i.test(header(msg, "Auto-Submitted") ?? "") || Boolean(header(msg, "X-Autoreply")),
    };
  },
};

export interface SendInput {
  to: string;
  subject: string;
  text: string;
  threadId?: string | null;
  inReplyTo?: string | null;
  unsubscribeUrl?: string | null;
}

export interface InboundEmail {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  messageId: string | null;
  date: string;
  text: string;
  isAutoReply: boolean;
}

interface GmailPart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

function accessToken() {
  return googleAccessToken(process.env.GMAIL_SENDER ?? "", SCOPE);
}

async function api<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Gmail: ${json.error?.message ?? `HTTP ${res.status}`}`);
  return json;
}

/** RFC 2822 plain-text message, base64url-encoded for the Gmail API. */
export function buildMime(input: SendInput, from: string, fromName: string) {
  const headers = [
    `From: ${fromName ? `${encodeWord(fromName)} <${from}>` : from}`,
    `To: ${input.to}`,
    `Subject: ${encodeWord(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`);
  const unsub = [`<mailto:${from}?subject=unsubscribe>`, input.unsubscribeUrl ? `<${input.unsubscribeUrl}>` : null].filter(Boolean).join(", ");
  headers.push(`List-Unsubscribe: ${unsub}`);
  if (input.unsubscribeUrl) headers.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  const body = Buffer.from(input.text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  return b64url(`${headers.join("\r\n")}\r\n\r\n${body}`);
}

function encodeWord(text: string) {
  return /^[\x00-\x7F]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function header(msg: GmailMessage | null, name: string) {
  return msg?.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function plainText(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const child of part.parts ?? []) {
    const text = plainText(child);
    if (text) return text;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }
  return "";
}

/** Drops the quoted thread below a reply ("On … wrote:", "> …"). */
export function stripQuoted(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .{5,200}wrote:\s*$/i.test(line.trim()) || /^-{2,}\s*Original Message/i.test(line.trim()) || /^From: .+/.test(line.trim())) break;
    if (line.trim().startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim().slice(0, 4000);
}
