import "server-only";

import { graphRequest } from "./meta";
import { hasCredentials, isMessagingLive, simulated, type SendResult } from "./safety";

// WhatsApp Business Platform (Cloud API).
//
// POST https://graph.facebook.com/{version}/{WHATSAPP_PHONE_NUMBER_ID}/messages
//
// Meta's rules: a free-form text can only be sent within 24 hours of the
// customer's last message. Outside that window the business must send a
// template approved in WhatsApp Manager. Inbound messages and delivery
// receipts arrive at /api/webhooks/meta.

const KEYS = ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN"] as const;

interface SendResponse {
  messages?: { id: string }[];
}

export const whatsapp = {
  provider: "whatsapp" as const,
  envKeys: KEYS,

  isConfigured() {
    return hasCredentials(...KEYS);
  },

  isLive() {
    return isMessagingLive() && this.isConfigured();
  },

  /** Free-form text — only valid inside the 24-hour customer service window. */
  async sendText(input: { to: string; body: string }): Promise<SendResult> {
    const to = normalizeNumber(input.to);
    if (!this.isLive()) return simulated("whatsapp", `To ${maskNumber(to)}: ${input.body}`);
    const res = await post({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: input.body } });
    return sent(res, `To ${maskNumber(to)}: ${input.body}`);
  },

  /** A Meta-approved template; `params` fill {{1}}, {{2}}… in the template body, in order. */
  async sendTemplate(input: { to: string; templateName: string; params: string[]; renderedBody: string }): Promise<SendResult> {
    const to = normalizeNumber(input.to);
    const preview = `To ${maskNumber(to)} (template “${input.templateName}”): ${input.renderedBody}`;
    if (!this.isLive()) return simulated("whatsapp", preview);
    const res = await post({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en" },
        ...(input.params.length > 0 ? { components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text })) }] } : {}),
      },
    });
    return sent(res, preview);
  },
};

function post(body: unknown) {
  return graphRequest<SendResponse>("graph.facebook.com", `${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, process.env.WHATSAPP_ACCESS_TOKEN!, { method: "POST", body });
}

function sent(res: SendResponse, preview: string): SendResult {
  return { status: "sent", provider: "whatsapp", preview, externalId: res.messages?.[0]?.id ?? null, at: new Date().toISOString() };
}

/**
 * WhatsApp wants digits with the country code and no "+". A bare 10-digit
 * number gets WHATSAPP_DEFAULT_COUNTRY_CODE (e.g. 91 for India) in front.
 */
export function normalizeNumber(number: string) {
  let digits = number.replace(/\D/g, "").replace(/^00/, "");
  const cc = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.replace(/\D/g, "");
  if (cc && digits.length === 10) digits = cc + digits;
  if (cc && digits.length === 11 && digits.startsWith("0")) digits = cc + digits.slice(1);
  return digits;
}

function maskNumber(number: string) {
  return number.length > 4 ? `${"•".repeat(Math.max(0, number.length - 4))}${number.slice(-4)}` : number;
}
