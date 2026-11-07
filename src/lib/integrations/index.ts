import "server-only";

import { instagram } from "./instagram";
import { metaAds } from "./meta-ads";
import { whatsapp } from "./whatsapp";

export { isMessagingLive, renderTemplate } from "./safety";
export { instagram, metaAds, whatsapp };

export function integrationEnvStatus() {
  return {
    whatsapp: whatsapp.isConfigured(),
    instagram: instagram.isConfigured(),
    meta_ads: metaAds.isConfigured(),
    webhook: Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN && (process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET) && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.META_WEBHOOK_WORKSPACE),
  };
}

/** Which env vars are set, per name. Values are never returned. */
export function envKeyStatus(keys: readonly string[]) {
  return keys.map((key) => ({ key, set: Boolean(process.env[key]) }));
}
