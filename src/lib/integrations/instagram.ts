import "server-only";

import { DRY_RUN, hasCredentials, simulated, type SimulatedResult } from "./safety";

// Instagram Messaging (Graph API) placeholder.
//
// Going live later means implementing `sendDirectMessage` against the
// Instagram Messaging API for INSTAGRAM_BUSINESS_ACCOUNT_ID (24h messaging
// window rules apply) plus a webhook route for inbound DMs and comments.
// Until then every call is a dry run: no network request is made.

export const instagram = {
  provider: "instagram" as const,

  isConfigured() {
    return hasCredentials("INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN");
  },

  async sendDirectMessage(input: { handle: string; body: string }): Promise<SimulatedResult> {
    if (!DRY_RUN) throw new Error("Live Instagram messaging is not implemented.");
    return simulated("instagram", `To @${input.handle}: ${input.body}`);
  },
};
