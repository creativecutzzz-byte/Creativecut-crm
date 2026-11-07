import "server-only";

import { headers } from "next/headers";

/** Public base URL of this deployment. NEXT_PUBLIC_SITE_URL wins over request headers. */
export async function siteUrl() {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (fixed) return fixed;
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  return `${list.get("x-forwarded-proto") ?? "https"}://${host}`;
}

export async function webhookUrl() {
  return `${await siteUrl()}/api/webhooks/meta`;
}
