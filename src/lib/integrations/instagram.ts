import "server-only";

import { graphRequest } from "./meta";
import { hasCredentials, isMessagingLive, simulated, type SendResult } from "./safety";

// Instagram API with Instagram Login (Messaging).
//
// POST https://graph.instagram.com/{version}/{INSTAGRAM_BUSINESS_ACCOUNT_ID}/messages
//
// Meta's rules: you can only message someone who has messaged your account
// first, addressed by their Instagram-scoped id (IGSID, delivered by the
// webhook) — not by @handle — and only within 24 hours of their last message.

const KEYS = ["INSTAGRAM_BUSINESS_ACCOUNT_ID", "INSTAGRAM_ACCESS_TOKEN"] as const;

export const instagram = {
  provider: "instagram" as const,
  envKeys: KEYS,

  isConfigured() {
    return hasCredentials(...KEYS);
  },

  isLive() {
    return isMessagingLive() && this.isConfigured();
  },

  async sendDirectMessage(input: { recipientId: string | null; handle: string; body: string }): Promise<SendResult> {
    const preview = `To @${input.handle}: ${input.body}`;
    if (!this.isLive()) return simulated("instagram", preview);
    if (!input.recipientId) throw new Error(`@${input.handle} hasn't messaged your Instagram account yet. Instagram only allows replies to people who DM you first.`);
    const res = await graphRequest<{ message_id?: string }>("graph.instagram.com", `${process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/messages`, process.env.INSTAGRAM_ACCESS_TOKEN!, {
      method: "POST",
      body: { recipient: { id: input.recipientId }, message: { text: input.body } },
    });
    return { status: "sent", provider: "instagram", preview, externalId: res.message_id ?? null, at: new Date().toISOString() };
  },

  /** Name and @username of someone who messaged the account. Best effort. */
  async getProfile(igsid: string): Promise<{ name?: string; username?: string }> {
    if (!this.isConfigured()) return {};
    try {
      return await graphRequest<{ name?: string; username?: string }>("graph.instagram.com", `${encodeURIComponent(igsid)}?fields=name,username`, process.env.INSTAGRAM_ACCESS_TOKEN!);
    } catch {
      return {};
    }
  },
};
