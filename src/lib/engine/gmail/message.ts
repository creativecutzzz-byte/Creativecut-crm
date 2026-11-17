// Builds an RFC 5322 plain-text message for the Gmail API `raw` field.
// Plain text only: no HTML, no tracking pixel, no wrapped links.

export interface RawMessageInput {
  from: string; // "Name <mailbox@domain>" or a bare address
  to: string;
  subject: string;
  body: string;
  messageId: string; // "<...@domain>"
  inReplyTo?: string | null; // previous step's RFC Message-ID, for follow-ups
  unsubMailto: string;
  unsubUrl: string;
}

/** RFC 2047 encode a header value when it isn't plain ASCII. */
export function encodeHeader(value: string) {
  const clean = value.replace(/[\r\n]+/g, " ").trim();
  return /^[\x20-\x7e]*$/.test(clean) ? clean : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

export function formatFrom(name: string | null | undefined, email: string) {
  if (!name) return email;
  const safe = name.replace(/["\\\r\n]/g, "").trim();
  return /^[\x20-\x7e]*$/.test(safe) ? `"${safe}" <${email}>` : `${encodeHeader(safe)} <${email}>`;
}

export function rawMessage(m: RawMessageInput) {
  const headers = [
    `From: ${m.from}`,
    `To: ${m.to.replace(/[\r\n]/g, "")}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Message-ID: ${m.messageId}`,
    `List-Unsubscribe: <mailto:${m.unsubMailto}>, <${m.unsubUrl}>`,
    "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  if (m.inReplyTo) headers.push(`In-Reply-To: ${m.inReplyTo}`, `References: ${m.inReplyTo}`);
  const body = m.body.replace(/\r?\n/g, "\r\n");
  return Buffer.from(headers.join("\r\n") + "\r\n\r\n" + body, "utf8").toString("base64url");
}

export function newMessageId(mailbox: string) {
  const domain = mailbox.split("@")[1] ?? "localhost";
  const rand = crypto.randomUUID().replace(/-/g, "");
  return `<${Date.now().toString(36)}.${rand}@${domain}>`;
}
