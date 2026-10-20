import "server-only";

import { instagram } from "./instagram";
import { metaAds } from "./meta-ads";
import { whatsapp } from "./whatsapp";

export { DRY_RUN, renderTemplate } from "./safety";
export { instagram, metaAds, whatsapp };

export function integrationEnvStatus() {
  return {
    whatsapp: whatsapp.isConfigured(),
    instagram: instagram.isConfigured(),
    meta_ads: metaAds.isConfigured(),
  };
}
