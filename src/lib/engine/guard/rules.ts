import type { GuardConfig } from "../config";

// Pure guard rule evaluation (docs/guide.md, Step 9). Thresholds come from
// config/guard.yaml. Covered by tests.

export type GuardAction = "none" | "pause" | "halve" | "alert";

export interface RuleResult {
  rule: string;
  value: number | string | null;
  threshold: string;
  action: GuardAction;
}

export function rate(n: number, total: number) {
  return total > 0 ? n / total : 0;
}

export function mailboxBounceRule(bounced: number, sends: number, cfg: GuardConfig): RuleResult {
  const r = rate(bounced, sends);
  const breach = sends >= cfg.mailbox_bounce.min_sends && r >= cfg.mailbox_bounce.rate;
  return { rule: "mailbox_bounce", value: r, threshold: `≥ ${cfg.mailbox_bounce.rate * 100}% of last ${cfg.mailbox_bounce.window} (min ${cfg.mailbox_bounce.min_sends})`, action: breach ? "pause" : "none" };
}

export function domainBounceRule(bounced: number, sends: number, cfg: GuardConfig): RuleResult {
  const r = rate(bounced, sends);
  // Same 30-send floor as the mailbox rule so one early bounce can't pause a fresh domain.
  const breach = sends >= cfg.mailbox_bounce.min_sends && r >= cfg.domain_bounce.rate;
  return { rule: "domain_bounce", value: r, threshold: `≥ ${cfg.domain_bounce.rate * 100}% of last ${cfg.domain_bounce.window}`, action: breach ? "pause" : "none" };
}

export function negativeReplyRule(negative: number, sends: number, cfg: GuardConfig): RuleResult {
  const r = rate(negative, sends);
  const breach = sends >= cfg.mailbox_bounce.min_sends && r >= cfg.negative_replies.rate;
  return { rule: "negative_replies", value: r, threshold: `≥ ${cfg.negative_replies.rate * 100}% of last ${cfg.negative_replies.window}`, action: breach ? "pause" : "none" };
}

export function postmasterRules(p: { spam_rate: number | null; reputation: string | null } | null, cfg: GuardConfig): RuleResult[] {
  const spam = p?.spam_rate ?? null;
  const spamAction: GuardAction = spam == null ? "none" : spam >= cfg.postmaster.spam_rate_pause ? "pause" : spam >= cfg.postmaster.spam_rate_halve ? "halve" : "none";
  const rep = p?.reputation?.toUpperCase() ?? null;
  return [
    { rule: "postmaster_spam_rate", value: spam, threshold: `halve ≥ ${cfg.postmaster.spam_rate_halve * 100}%, pause ≥ ${cfg.postmaster.spam_rate_pause * 100}%`, action: spamAction },
    { rule: "postmaster_reputation", value: rep, threshold: `pause on ${cfg.postmaster.pause_reputations.join("/")}`, action: rep && cfg.postmaster.pause_reputations.includes(rep) ? "pause" : "none" },
  ];
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Alert only: recent reply rate under `ratio` × the 7-day median, with enough sends. */
export function replyRateRule(recent: { replies: number; sends: number }, dailyRates: number[], cfg: GuardConfig): RuleResult {
  const r = rate(recent.replies, recent.sends);
  const med = median(dailyRates);
  const breach = recent.sends >= cfg.reply_rate_alert.min_sends && med > 0 && r < med * cfg.reply_rate_alert.ratio;
  return { rule: "reply_rate", value: r, threshold: `< ${cfg.reply_rate_alert.ratio} × 7-day median (${(med * 100).toFixed(2)}%)`, action: breach ? "alert" : "none" };
}
