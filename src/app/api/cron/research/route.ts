import { runCron } from "@/lib/engine/cron";
import { verifyLeads } from "@/lib/engine/intake/verify";
import { qualifyLeads } from "@/lib/engine/intake/qualify";
import { researchLeads } from "@/lib/engine/research/research";

// Every minute: one small batch per pipeline stage — verify, ICP-qualify, research + gate.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const n = (v: string | undefined, d: number) => Number(v) > 0 ? Number(v) : d;

export function GET(req: Request) {
  return runCron(req, "research", async () => {
    const [verify, qualify] = await Promise.all([
      verifyLeads(n(process.env.VERIFY_BATCH, 25)),
      qualifyLeads(n(process.env.QUALIFY_BATCH, 10)),
    ]);
    const research = await researchLeads(n(process.env.RESEARCH_BATCH, 8));
    return { verify, qualify, research };
  });
}
