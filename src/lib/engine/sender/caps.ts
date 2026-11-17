// Warm-up ramp and daily caps (docs/guide.md, Steps 2 and 7). Pure — covered by tests.

export const MAILBOX_MAX = 40;
export const DOMAIN_MAX = 120;

/** Per-mailbox daily cap for the ramp week: wk1 10, wk2 20, wk3 30, wk4+ 40. */
export function rampCap(rampStartedOn: Date | string, today = new Date()) {
  const start = new Date(rampStartedOn);
  const days = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86_400_000));
  const week = Math.floor(days / 7) + 1;
  return Math.min(MAILBOX_MAX, week * 10);
}

/** How many more sends this mailbox may make today: the smaller of its own cap and what is left of its domain's cap. */
export function allowedSends(m: { cap: number; sentToday: number; domainCap: number; domainSentToday: number }) {
  const mailboxLeft = Math.min(m.cap, MAILBOX_MAX) - m.sentToday;
  const domainLeft = Math.min(m.domainCap, DOMAIN_MAX) - m.domainSentToday;
  return Math.max(0, Math.min(mailboxLeft, domainLeft));
}

/** Random gap before this mailbox's next send: 45-180 seconds inclusive. */
export function nextGapSeconds(rand: (min: number, maxExclusive: number) => number) {
  return rand(45, 181);
}
