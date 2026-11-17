// Deterministic reply checks that run before any model call. Pure — covered by tests.

export function isBounce(from: string, headers: Record<string, string>, subject = "") {
  const f = from.toLowerCase();
  if (/mailer-daemon|postmaster@|mail delivery (subsystem|system)/.test(f)) return true;
  if (/multipart\/report/i.test(headers["content-type"] ?? "") && /delivery-status/i.test(headers["content-type"] ?? "")) return true;
  return /^(undeliverable|delivery status notification \(failure\)|mail delivery failed|returned mail)/i.test(subject.trim());
}

/** Hard bounce unless the report says the failure is temporary (4.x.x). */
export function isHardBounce(body: string) {
  if (/\b4\.\d{1,3}\.\d{1,3}\b|temporar(y|ily)|try again later|mailbox (is )?full|over quota/i.test(body) && !/\b5\.\d{1,3}\.\d{1,3}\b/.test(body)) return false;
  return true;
}

export function bouncedAddress(body: string): string | null {
  const m =
    body.match(/Final-Recipient:\s*rfc822;\s*<?([^\s>]+@[^\s>]+)>?/i) ??
    body.match(/Original-Recipient:\s*rfc822;\s*<?([^\s>]+@[^\s>]+)>?/i) ??
    body.match(/(?:wasn't delivered to|could not be delivered to|delivery to the following recipient[s]? failed[^\n]*\n)\s*<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i);
  return m ? m[1]!.toLowerCase().replace(/[.,;]+$/, "") : null;
}

export function isAutoReply(headers: Record<string, string>, subject = "") {
  const auto = (headers["auto-submitted"] ?? "").toLowerCase();
  if (auto && auto !== "no") return true;
  if (headers["x-autoreply"] || headers["x-autorespond"] || headers["x-auto-response-suppress"]?.match(/oof|all/i)) return true;
  if (/^(auto_reply|bulk|junk)$/i.test((headers["precedence"] ?? "").trim())) return true;
  return /^(out of (the )?office|automatic reply|auto(matic)?[- ]?reply|autoreply|on leave|away from (the )?office|i am (currently )?out of)/i.test(subject.trim());
}

/** Removes the quoted thread ("On ... wrote:", "> " lines, forwarded blocks, our own signature/opt-out). */
export function stripQuoted(body: string) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*On .{3,200}wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^\s*From:\s.+/i.test(line) || /^_{5,}\s*$/.test(line)) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

const OPT_OUT = /\b(stop (emailing|contacting|sending|messaging|writing)|unsubscribe|remove me|take me off|do not (contact|email|e-mail)|don'?t (contact|email|e-mail)|opt[- ]?out|no more emails?)\b/i;

/** Deterministic opt-out phrases. A bare "no" also counts — our opt-out line asks for exactly that. */
export function isOptOut(text: string) {
  const t = text.trim();
  if (/^(no|nope|no thanks|no thank you|stop)[.!]?$/i.test(t)) return true;
  return OPT_OUT.test(t.slice(0, 400));
}
