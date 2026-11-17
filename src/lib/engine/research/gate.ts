// The quality gate is plain code, not another opinion from the model
// (docs/guide.md, Step 6). Pure functions — covered by tests.

/** Lowercase, collapse everything that is not a letter or digit to single spaces. Curly quotes and line breaks never cause a false failure. */
export const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function quotePasses(quote: string | null, pageText: string): boolean {
  if (!quote) return true; // generic email: tagged generic, its reply rate tracked separately
  const q = norm(quote);
  return q.split(" ").length >= 6 && norm(pageText).includes(q);
}

/** Which of the fetched pages contains the quote (prefers the one the model named). */
export function pageWithQuote(quote: string, pages: { url: string; text: string }[], preferredUrl?: string | null) {
  const ordered = [...pages].sort((a, b) => Number(b.url === preferredUrl) - Number(a.url === preferredUrl));
  return ordered.find((p) => quotePasses(quote, p.text)) ?? null;
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|io|co|net|org|ai|app|dev|xyz|me|us|uk)\b(\/\S*)?)/i;
const PLACEHOLDER = /\{[^}]*\}|\[[^\]]*\]|<[^>]+>|\b(first_name|company_name|FIRST NAME|COMPANY)\b/;

export function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function allCapsWords(s: string) {
  // Acronyms up to 4 letters (CEO, B2B, SaaS, D2C) are fine; shouting is not.
  return (s.match(/\b[A-Z]{5,}\b/g) ?? []);
}

export interface HygieneInput {
  subject: string;
  body: string;
  followups: string[];
}

/** Hygiene check: no links, no placeholders, word counts in range, short subject, no all-caps words. Returns the problems (empty = pass). */
export function hygieneProblems(d: HygieneInput): string[] {
  const problems: string[] = [];
  const all = [d.subject, d.body, ...d.followups];
  if (all.some((t) => LINK.test(t))) problems.push("contains a link or web address");
  if (all.some((t) => PLACEHOLDER.test(t))) problems.push("contains a leftover placeholder");
  const words = wordCount(d.body);
  if (words < 60 || words > 110) problems.push(`body is ${words} words (needs 60-110)`);
  const subjectWords = wordCount(d.subject);
  if (subjectWords === 0 || subjectWords > 8) problems.push(`subject is ${subjectWords} words (needs 1-8)`);
  if (/^\s*(re|fwd?)\s*:/i.test(d.subject)) problems.push('subject starts with a fake "Re:" or "Fwd:"');
  for (const [i, f] of d.followups.entries()) {
    const n = wordCount(f);
    if (n < 8 || n > 90) problems.push(`follow-up ${i + 1} is ${n} words (needs 8-90)`);
  }
  if (all.some((t) => allCapsWords(t).length)) problems.push("contains all-caps words");
  return problems;
}
