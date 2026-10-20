import "server-only";

import { hasCredentials } from "./safety";

// Meta Marketing API placeholder — analytics only.
//
// The CRM reads campaign insights; it never creates, edits, budgets or
// launches ads, and there is intentionally no write method here. Going live
// later means a scheduled job calling GET /{ad_account_id}/insights with
// `ads_read` scope only, upserting into `ad_campaigns` / `ad_insights_daily`.

export const metaAds = {
  provider: "meta_ads" as const,

  isConfigured() {
    return hasCredentials("META_ADS_ACCOUNT_ID", "META_ADS_ACCESS_TOKEN");
  },

  /** Required OAuth scopes. Read-only by design. */
  scopes: ["ads_read"] as const,
};
