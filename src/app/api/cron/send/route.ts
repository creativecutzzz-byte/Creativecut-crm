import { runCron } from "@/lib/engine/cron";
import { sendTick } from "@/lib/engine/sender/send";

// Every minute: each due mailbox sends at most ONE email.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function GET(req: Request) {
  return runCron(req, "send", () => sendTick());
}
