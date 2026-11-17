import type { Icp } from "../config";
import { countryCode, leadTimeZone } from "./countries";

// CSV row -> clean lead, plus the cheap rejection rules that run before any
// paid verification or AI call (docs/guide.md, Step 5 "Intake and cleaning").

export interface CleanLead {
  email: string;
  first_name: string;
  last_name: string | null;
  title: string | null;
  company: string;
  website: string;
  country: string | null;
  timezone: string;
  employees: number | null;
  segment: string | null;
  source: string;
}

export type Rejection = "missing_fields" | "invalid_email" | "role_address" | "free_mail" | "country" | "suppressed" | "duplicate";

const ROLE_PREFIXES = new Set([
  "info", "sales", "support", "hello", "contact", "admin", "office", "team", "help", "marketing", "careers", "jobs",
  "hr", "billing", "accounts", "enquiries", "enquiry", "noreply", "no-reply", "postmaster", "abuse", "webmaster", "press",
  "media", "partnerships", "hi", "mail", "general",
]);

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "hotmail.com", "outlook.com", "live.com",
  "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "rediffmail.com", "zoho.com", "gmx.com",
  "yandex.com", "mail.com",
]);

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const normEmail = (e: string) => e.trim().toLowerCase();
export const emailDomain = (e: string) => normEmail(e).split("@")[1] ?? "";

export function isRoleAddress(email: string) {
  const local = normEmail(email).split("@")[0] ?? "";
  return ROLE_PREFIXES.has(local.split("+")[0]!);
}

export const isFreeMail = (email: string) => FREE_MAIL.has(emailDomain(email));

export function normaliseWebsite(raw: string | undefined, email: string) {
  let site = (raw ?? "").trim();
  if (!site) site = emailDomain(email);
  if (!site) return "";
  if (!/^https?:\/\//i.test(site)) site = `https://${site}`;
  try {
    const url = new URL(site);
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (row[k]?.trim()) return row[k]!.trim();
  return "";
};

/** Normalises one CSV row. Returns the lead or the reason it was rejected. */
export function normaliseRow(row: Record<string, string>, icp: Icp, source = "csv"): CleanLead | { rejected: Rejection } {
  const email = normEmail(pick(row, "email", "email_address", "work_email"));
  const first = pick(row, "first_name", "firstname", "first");
  const company = pick(row, "company", "company_name", "organization", "organisation");
  if (!email || !first || !company) return { rejected: "missing_fields" };
  if (!EMAIL_RE.test(email)) return { rejected: "invalid_email" };
  if (isRoleAddress(email)) return { rejected: "role_address" };
  if (icp.business_email_only && isFreeMail(email)) return { rejected: "free_mail" };
  const website = normaliseWebsite(pick(row, "website", "company_website", "domain", "url"), email);
  if (!website) return { rejected: "missing_fields" };

  const countryRaw = pick(row, "country", "country_code");
  const country = countryCode(countryRaw);
  // Unknown country is rejected too: we only send to regions on the allow-list.
  if (!country || !icp.allowed_countries.includes(country)) return { rejected: "country" };

  const employeesRaw = pick(row, "employees", "employee_count", "company_size", "headcount");
  const employees = employeesRaw ? Number.parseInt(employeesRaw.replace(/[^\d]/g, ""), 10) || null : null;

  return {
    email,
    first_name: first.replace(/\s+/g, " "),
    last_name: pick(row, "last_name", "lastname", "last") || null,
    title: pick(row, "title", "job_title", "position") || null,
    company: company.replace(/\s+/g, " "),
    website,
    country,
    timezone: leadTimeZone(pick(row, "timezone", "time_zone"), country),
    employees,
    segment: pick(row, "segment", "industry") || null,
    source,
  };
}

/** Cheap rule layer of ICP qualification (title, country, company size). */
export function ruleCheck(lead: { title: string | null; country: string | null; employees: number | null }, icp: Icp): { ok: true } | { ok: false; reason: string } {
  if (!lead.country || !icp.allowed_countries.includes(lead.country)) return { ok: false, reason: `Country ${lead.country ?? "unknown"} is not on the allow-list` };
  if (icp.target_titles.length && lead.title) {
    const t = lead.title.toLowerCase();
    const match = icp.target_titles.some((target) => titleMatches(t, target.toLowerCase()));
    if (!match) return { ok: false, reason: `Title "${lead.title}" is not a target title` };
  }
  if (lead.employees != null) {
    const [min, max] = icp.employee_range;
    if (lead.employees < min || lead.employees > max) return { ok: false, reason: `Company size ${lead.employees} is outside ${min}-${max}` };
  }
  return { ok: true };
}

function titleMatches(title: string, target: string) {
  if (title.includes(target)) return true;
  // "CEO & Co-founder", "Founder/CEO", "Head of Growth Marketing"
  const words = target.split(/\s+/).filter((w) => w.length > 2 && w !== "of" && w !== "the");
  return words.length > 0 && words.every((w) => title.includes(w));
}
