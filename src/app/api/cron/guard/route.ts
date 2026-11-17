import { runCron } from "@/lib/engine/cron";
import { runGuard } from "@/lib/engine/guard/run";

// Every 5 minutes: pause mailboxes / domains on bounce, complaint and reputation signals.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export function GET(req: Request) {
  return runCron(req, "guard", async () => {
    const report = await runGuard();
    const breaches = [...report.mailboxes, ...report.domains].flatMap((x) => x.rules.filter((r) => r.action !== "none"));
    return { checked: { mailboxes: report.mailboxes.length, domains: report.domains.length }, breaches };
  });
}
