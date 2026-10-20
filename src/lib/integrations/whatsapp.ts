import "server-only";

import { DRY_RUN, hasCredentials, simulated, type SimulatedResult } from "./safety";

// WhatsApp Business (Cloud API) placeholder.
//
// Going live later means implementing `sendTemplateMessage` against
// POST https://graph.facebook.com/{version}/{WHATSAPP_PHONE_NUMBER_ID}/messages
// with the token from Supabase Vault / WHATSAPP_ACCESS_TOKEN, and a webhook
// route for inbound messages + delivery receipts. Until then every call is a
// dry run: no network request is made.

export const whatsapp = {
  provider: "whatsapp" as const,

  isConfigured() {
    return hasCredentials("WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN");
  },

  async sendTemplateMessage(input: { to: string; templateName: string | null; renderedBody: string }): Promise<SimulatedResult> {
    if (!DRY_RUN) throw new Error("Live WhatsApp sending is not implemented.");
    return simulated("whatsapp", `To ${maskNumber(input.to)}: ${input.renderedBody}`);
  },
};

function maskNumber(number: string) {
  return number.length > 4 ? `${"•".repeat(Math.max(0, number.length - 4))}${number.slice(-4)}` : number;
}
