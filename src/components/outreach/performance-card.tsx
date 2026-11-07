import { Card, CardHeader } from "@/components/ui/card";
import type { StepStat, VariantStat } from "@/lib/outreach/performance";

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "—";
}

export function PerformanceCard({ sent, replied, steps, variants }: { sent: number; replied: number; steps: StepStat[]; variants: VariantStat[] }) {
  const rows = steps.filter((s) => s.channel !== "linkedin");
  return (
    <Card>
      <CardHeader title="What's working (last 30 days)" description={`${sent} messages sent · ${replied} people replied (${pct(replied, sent)}). A reply counts for the last message before it.`} />
      <div className="overflow-x-auto px-5 pb-5">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-subtle">No sent sequence messages yet.</p>
        ) : (
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="text-subtle">
              <tr>
                <th className="py-2 font-medium">Step</th>
                <th className="py-2 text-right font-medium">Sent</th>
                <th className="py-2 text-right font-medium">Replies</th>
                <th className="py-2 text-right font-medium">Positive</th>
                <th className="py-2 text-right font-medium">Reply rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.key}>
                  <td className="py-2">
                    {s.label} <span className="text-subtle">· {s.channel}</span>
                  </td>
                  <td className="py-2 text-right">{s.sent}</td>
                  <td className="py-2 text-right">{s.replies}</td>
                  <td className="py-2 text-right">{s.positive}</td>
                  <td className="py-2 text-right font-medium">{pct(s.replies, s.sent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {variants.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted">Subject line A/B test</p>
            <ul className="space-y-1.5 text-xs">
              {variants.map((v) => (
                <li key={`${v.label}${v.variant}`} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{v.variant}</span> · {v.label}
                    {v.example ? <span className="text-subtle"> · e.g. “{v.example}”</span> : null}
                  </span>
                  <span className="shrink-0">
                    {v.replies}/{v.sent} · <span className="font-medium">{pct(v.replies, v.sent)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-subtle">Wait for at least ~50 sends per variant before trusting a difference.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
