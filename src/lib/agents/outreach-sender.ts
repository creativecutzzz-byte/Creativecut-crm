import "server-only";

import { DEFAULT_SENDER_SETTINGS, processQueue, senderSettingsSchema, type SenderSettings } from "@/lib/outreach/sender";
import { gmail } from "@/lib/integrations/gmail";
import { defineAgent } from "./types";

// Outreach Sender: delivers approved messages inside the sending window, up to
// the daily email cap. Nothing reaches a lead unless MESSAGING_MODE=live.

export const outreachSenderAgent = defineAgent<SenderSettings>({
  key: "outreach_sender",
  name: "Outreach Sender",
  department: "outreach",
  description: "Sends approved messages from your Google Workspace mailbox (and WhatsApp templates) within sending hours, up to a daily cap, threading follow-ups.",
  requires: [],
  needsAi: false,
  minIntervalHours: 0,
  configSchema: senderSettingsSchema,
  defaultConfig: DEFAULT_SENDER_SETTINGS,
  configHelp:
    "daily_email_cap: max cold emails per day (start at 20–30 on a new domain, raise slowly). window_start_hour / window_end_hour: IST hours to send in. send_days: 0=Sun … 6=Sat. postal_address: your business address for the email footer.",

  async run(ctx, cfg) {
    const c = await processQueue(ctx.supabase, ctx.orgId, cfg);
    const mode = gmail.isLive() ? "" : " (dry-run: nothing delivered)";
    return {
      status: "success",
      summary: `Sent ${c.sent}, simulated ${c.simulated}, re-queued ${c.scheduled}, cancelled ${c.cancelled}, failed ${c.failed}${c.blocked ? `, blocked ${c.blocked}` : ""}${mode}.`,
      created: c.sent + c.simulated,
      updated: c.scheduled,
    };
  },
});
