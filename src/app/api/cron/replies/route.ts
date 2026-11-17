import { runCron } from "@/lib/engine/cron";
import { isGmailConfigured } from "@/lib/engine/gmail/auth";
import { pollReplies } from "@/lib/engine/replies/poll";

// Every 3 minutes: Gmail history per mailbox -> classify -> stop sequences.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(req: Request) {
  return runCron(req, "replies", async () => (isGmailConfigured() ? pollReplies() : { skipped: "Gmail service account is not configured" }));
}
