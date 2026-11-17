import type { gmail_v1 } from "googleapis";
import { gmailFor } from "./auth";

// The Gmail operations the engine needs, behind an interface so tests can use
// a fake mailbox instead of Google.

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  internalDate: number;
  from: string;
  headers: Record<string, string>;
}

export interface GmailPort {
  send(mailbox: string, raw: string, threadId?: string | null): Promise<{ id: string; threadId: string }>;
  rfcMessageId(mailbox: string, messageId: string): Promise<string | null>;
  threadMessages(mailbox: string, threadId: string): Promise<GmailMessageMeta[]>;
  /** New message ids since historyId; returns null when the history id expired. */
  historySince(mailbox: string, historyId: string): Promise<{ messageIds: string[]; historyId: string } | null>;
  currentHistoryId(mailbox: string): Promise<string>;
  recentInbound(mailbox: string, days: number): Promise<string[]>;
  getMessage(mailbox: string, id: string): Promise<{ meta: GmailMessageMeta; body: string; labelIds: string[] }>;
}

export function headerMap(headers: gmail_v1.Schema$MessagePartHeader[] | undefined) {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) if (h.name) out[h.name.toLowerCase()] = h.value ?? "";
  return out;
}

function decode(data: string | null | undefined) {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

/** Plain-text body of a message (falls back to stripped HTML). */
export function extractText(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const t = extractText(p);
    if (t) return t;
  }
  if (part.mimeType === "text/html" && part.body?.data) return decode(part.body.data).replace(/<[^>]+>/g, " ");
  return part.body?.data && !part.parts ? decode(part.body.data) : "";
}

const meta = (m: gmail_v1.Schema$Message): GmailMessageMeta => {
  const headers = headerMap(m.payload?.headers);
  return { id: m.id!, threadId: m.threadId!, internalDate: Number(m.internalDate ?? 0), from: headers["from"] ?? "", headers };
};

export const googleGmail: GmailPort = {
  async send(mailbox, raw, threadId) {
    const res = await gmailFor(mailbox).users.messages.send({ userId: "me", requestBody: { raw, ...(threadId ? { threadId } : {}) } });
    return { id: res.data.id!, threadId: res.data.threadId! };
  },
  async rfcMessageId(mailbox, messageId) {
    const res = await gmailFor(mailbox).users.messages.get({ userId: "me", id: messageId, format: "metadata", metadataHeaders: ["Message-ID"] });
    return headerMap(res.data.payload?.headers)["message-id"] ?? null;
  },
  async threadMessages(mailbox, threadId) {
    const res = await gmailFor(mailbox).users.threads.get({ userId: "me", id: threadId, format: "metadata", metadataHeaders: ["From", "Auto-Submitted", "X-Autoreply", "Precedence", "Subject"] });
    return (res.data.messages ?? []).map(meta);
  },
  async historySince(mailbox, historyId) {
    const ids = new Set<string>();
    let pageToken: string | undefined;
    let latest = historyId;
    try {
      do {
        const res = await gmailFor(mailbox).users.history.list({ userId: "me", startHistoryId: historyId, historyTypes: ["messageAdded"], pageToken });
        for (const h of res.data.history ?? []) for (const a of h.messagesAdded ?? []) if (a.message?.id) ids.add(a.message.id);
        latest = res.data.historyId ?? latest;
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (err) {
      if ((err as { code?: number }).code === 404) return null; // history id too old
      throw err;
    }
    return { messageIds: [...ids], historyId: latest };
  },
  async currentHistoryId(mailbox) {
    const res = await gmailFor(mailbox).users.getProfile({ userId: "me" });
    return res.data.historyId!;
  },
  async recentInbound(mailbox, days) {
    const res = await gmailFor(mailbox).users.messages.list({ userId: "me", q: `in:inbox newer_than:${days}d`, maxResults: 200 });
    return (res.data.messages ?? []).map((m) => m.id!);
  },
  async getMessage(mailbox, id) {
    const res = await gmailFor(mailbox).users.messages.get({ userId: "me", id, format: "full" });
    return { meta: meta(res.data), body: extractText(res.data.payload), labelIds: res.data.labelIds ?? [] };
  },
};

/** Classifies a Gmail API error for the sender and the guard. */
export function classifyGmailError(err: unknown): "quota" | "auth" | "temporary" | "permanent" {
  const e = err as { code?: number; status?: number; message?: string; response?: { data?: { error?: string | { errors?: { reason?: string }[] } } } };
  const code = e.code ?? e.status ?? 0;
  const data = e.response?.data?.error;
  const reasons = typeof data === "object" ? (data.errors ?? []).map((x) => x.reason ?? "") : [];
  const text = `${typeof data === "string" ? data : ""} ${reasons.join(" ")} ${e.message ?? ""}`.toLowerCase();
  if (code === 429 || /ratelimit|quota|dailylimit|userratelimit|too many/.test(text)) return "quota";
  if (code === 401 || /invalid_grant|unauthorized_client|suspend|disabled|failedprecondition|mail service not enabled|suspicious|domain policy/.test(text)) return "auth";
  if (code === 403) return "auth";
  if (code >= 500 || code === 0) return "temporary";
  return "permanent";
}
