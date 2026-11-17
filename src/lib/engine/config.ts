import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

// Editable config lives in config/*.yaml (not in code). Read once per instance.

export const IcpSchema = z.object({
  industries: z.array(z.string()).default([]),
  employee_range: z.tuple([z.number(), z.number()]).default([1, 100000]),
  target_titles: z.array(z.string()).default([]),
  allowed_countries: z.array(z.string().length(2)).min(1),
  exclude: z.array(z.string()).default([]),
  min_score: z.number().min(0).max(100).default(70),
  business_email_only: z.boolean().default(true),
  keep_catch_all: z.boolean().default(false),
});
export type Icp = z.infer<typeof IcpSchema>;

export const GuardSchema = z.object({
  mailbox_bounce: z.object({ rate: z.number(), window: z.number().int(), min_sends: z.number().int() }),
  domain_bounce: z.object({ rate: z.number(), window: z.number().int() }),
  negative_replies: z.object({ rate: z.number(), window: z.number().int() }),
  quota_pause_hours: z.number(),
  postmaster: z.object({
    spam_rate_halve: z.number(),
    spam_rate_pause: z.number(),
    pause_reputations: z.array(z.string()),
  }),
  reply_rate_alert: z.object({ min_sends: z.number().int(), ratio: z.number() }),
});
export type GuardConfig = z.infer<typeof GuardSchema>;

const cache = new Map<string, unknown>();

export function readText(relPath: string) {
  // Files are bundled via outputFileTracingIncludes in next.config.ts.
  return readFileSync(join(/* turbopackIgnore: true */ process.cwd(), relPath), "utf8");
}

function load<T>(file: string, schema: z.ZodType<T>): T {
  if (!cache.has(file)) cache.set(file, schema.parse(parse(readText(file))));
  return cache.get(file) as T;
}

export const icpConfig = () => load("config/icp.yaml", IcpSchema);
export const guardConfig = () => load("config/guard.yaml", GuardSchema);

/** Company identity used in the signature and opt-out. All from env. */
export function senderIdentity() {
  return {
    company: process.env.OUTREACH_COMPANY_NAME || "Creative Cut",
    offer: process.env.OUTREACH_OFFER || "short-form video editing and content production for B2B brands",
    postalAddress: process.env.OUTREACH_POSTAL_ADDRESS || "",
    website: process.env.OUTREACH_COMPANY_WEBSITE || "",
  };
}
