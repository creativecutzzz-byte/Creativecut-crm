import { logEvent, setLeadStatus, claimLeads, type LeadRow } from "../db/queries";
import { icpConfig } from "../config";

// Email verification (docs/guide.md, Step 5). Provider: VERIFY_PROVIDER
// (zerobounce | neverbounce), key: VERIFY_API_KEY. Hard bounces damage domain
// reputation, so unverified leads never move on: without a provider configured
// leads stay "uploaded" (set VERIFY_PROVIDER=none only for a list you already
// verified elsewhere).

export type VerifyResult = "valid" | "invalid" | "catch_all" | "risky" | "unknown";

export function verificationMode(): "zerobounce" | "neverbounce" | "none" | null {
  const p = (process.env.VERIFY_PROVIDER || "").toLowerCase();
  if (p === "none") return "none";
  if (!process.env.VERIFY_API_KEY) return null;
  return p === "neverbounce" ? "neverbounce" : "zerobounce";
}

async function zerobounce(email: string): Promise<VerifyResult> {
  const url = new URL("https://api.zerobounce.net/v2/validate");
  url.searchParams.set("api_key", process.env.VERIFY_API_KEY!);
  url.searchParams.set("email", email);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ZeroBounce HTTP ${res.status}`);
  const data = (await res.json()) as { status?: string };
  switch (data.status) {
    case "valid": return "valid";
    case "invalid": case "spamtrap": case "abuse": case "do_not_mail": return "invalid";
    case "catch-all": return "catch_all";
    default: return "unknown";
  }
}

async function neverbounce(email: string): Promise<VerifyResult> {
  const url = new URL("https://api.neverbounce.com/v4/single/check");
  url.searchParams.set("key", process.env.VERIFY_API_KEY!);
  url.searchParams.set("email", email);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`NeverBounce HTTP ${res.status}`);
  const data = (await res.json()) as { result?: string };
  switch (data.result) {
    case "valid": return "valid";
    case "invalid": case "disposable": return "invalid";
    case "catchall": return "catch_all";
    default: return "unknown";
  }
}

export function verdict(result: VerifyResult, keepCatchAll: boolean): { status: "verified" | "disqualified"; segment?: string } {
  if (result === "valid") return { status: "verified" };
  if ((result === "catch_all" || result === "risky") && keepCatchAll) return { status: "verified", segment: "low_priority_catch_all" };
  return { status: "disqualified" };
}

/** Verifies one batch of uploaded leads. Returns how many were processed. */
export async function verifyLeads(batch = 25) {
  const mode = verificationMode();
  if (!mode) return { processed: 0, skipped: "VERIFY_API_KEY is not set" };
  const leads = await claimLeads("uploaded", batch);
  const icp = icpConfig();
  const results = await Promise.allSettled(
    leads.map(async (lead: LeadRow) => {
      const result: VerifyResult = mode === "none" ? "valid" : mode === "neverbounce" ? await neverbounce(lead.email) : await zerobounce(lead.email);
      const v = verdict(result, icp.keep_catch_all);
      await setLeadStatus(lead.id, v.status, {
        verify_result: mode === "none" ? "not_verified" : result,
        ...(v.segment ? { segment: v.segment } : {}),
        ...(v.status === "disqualified" ? { icp_reason: `Email verification: ${result}` } : {}),
      });
    }),
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    await logEvent("verify_failed", { count: failed.length, error: String((failed[0] as PromiseRejectedResult).reason) });
    // Leases expire, so failed leads are retried on a later tick.
  }
  return { processed: leads.length - failed.length, failed: failed.length };
}
