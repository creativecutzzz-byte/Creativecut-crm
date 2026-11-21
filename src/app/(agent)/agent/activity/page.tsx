import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, Loader2, MinusCircle } from "lucide-react";
import { Badge, Card, PageTitle } from "@/components/agent/ui";
import { formatDateTime } from "@/lib/agent/schedule";
import { getSnapshot } from "@/lib/agent/store";
import type { RunRecord } from "@/lib/agent/types";

export const metadata = { title: "Activity" };

const RESULT: Record<RunRecord["result"], { tone: "ok" | "warn" | "neutral" | "info"; icon: typeof CheckCircle2; label: string }> = {
  succeeded: { tone: "ok", icon: CheckCircle2, label: "Finished" },
  with_errors: { tone: "warn", icon: AlertTriangle, label: "Finished with a problem" },
  skipped: { tone: "neutral", icon: MinusCircle, label: "Skipped" },
  running: { tone: "info", icon: Loader2, label: "Running" },
};

function when(v: string) {
  const d = new Date(v.includes("T") ? v : `${v.replace(" ", "T")}:00+05:30`);
  return Number.isNaN(d.getTime()) ? v : formatDateTime(d);
}

export default async function ActivityPage() {
  const s = await getSnapshot();
  return (
    <div>
      <Link href="/agent" className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-semibold text-ag-brand hover:underline">
        <ArrowLeft aria-hidden className="size-4" /> Home
      </Link>
      <PageTitle title="Activity">
        {s.sheetUrl ? (
          <a href={s.sheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ag-brand hover:underline">
            Full data in Google Sheets <ExternalLink aria-hidden className="size-4" />
          </a>
        ) : null}
      </PageTitle>
      <h2 className="mb-3 text-lg font-bold">Run History</h2>
      {s.runs.length === 0 ? <p className="text-ag-text-2">No runs yet.</p> : null}
      <ul className="flex flex-col gap-3">
        {s.runs.map((r) => {
          const b = RESULT[r.result];
          return (
            <li key={r.id}>
              <Card as="article" className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-semibold">{when(r.startedAt)}</p>
                  <Badge tone={b.tone} icon={b.icon} spin={r.result === "running"}>
                    {b.label}
                  </Badge>
                  <span className="text-[14px] text-ag-text-3">
                    {r.trigger} · {r.mode === "LIVE" ? "Live sending" : "Preview only"}
                  </span>
                </div>
                <p className="mt-2 text-[15px] text-ag-text-2">{r.summary}</p>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
                  {[
                    ["Posts checked", r.found],
                    ["Qualified", r.qualified],
                    ["Drafts", r.drafted],
                    ["Sent", r.sent],
                    ["Skipped", r.skipped],
                    ["Cost", `$${r.costUsd.toFixed(2)}`],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl bg-ag-paper px-2 py-2">
                      <dd className="text-lg font-bold tabular-nums">{v}</dd>
                      <dt className="text-[12px] text-ag-text-3">{l}</dt>
                    </div>
                  ))}
                </dl>
                {r.diagnostics.length ? (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-[14px] font-semibold text-ag-text-2">Technical details</summary>
                    <ul className="mt-2 flex flex-col gap-1 rounded-xl bg-ag-paper p-3 font-mono text-[12px] text-ag-text-2">
                      <li>Run ID: {r.id}</li>
                      {r.diagnostics.map((d, i) => (
                        <li key={i} className="break-words">
                          {d}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
