import { SalesChart } from "@/components/charts/sales-chart";
import { AutoRefresh } from "@/components/live/auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getRequestTime, getViewer } from "@/lib/data";
import { razorpay, type Payment } from "@/lib/integrations/razorpay";
import { formatCurrency, formatRelative } from "@/lib/utils";
import { CalendarDays, IndianRupee, Receipt, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sales" };

const DAY = 86_400_000;

function istDate(ms: number) {
  return new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

export default async function SalesPage() {
  const viewer = await getViewer();
  const now = getRequestTime();
  if (!["owner", "admin", "manager"].includes(viewer.role)) {
    return <Notice>Sales are visible to owners, admins and managers.</Notice>;
  }
  if (!razorpay.isConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sales" description="Razorpay payments, read-only" />
        <Notice icon={Receipt}>
          <strong className="font-medium">Razorpay isn&apos;t connected.</strong> Razorpay Dashboard → Account &amp; Settings → API keys → switch to Live
          mode → Generate key. Add <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> in Vercel (type Sensitive) and redeploy. The CRM only
          reads payments; it can&apos;t refund or capture.
        </Notice>
      </div>
    );
  }

  let payments: Payment[] = [];
  let error: string | null = null;
  try {
    payments = (await razorpay.payments(new Date(now - 31 * DAY), new Date(now))).filter((p) => p.status === "captured");
  } catch (err) {
    error = err instanceof Error ? err.message : "Couldn't load payments";
  }

  const today = istDate(now);
  const month = today.slice(0, 7);
  const sum = (list: Payment[]) => list.reduce((s, p) => s + p.amount, 0);
  const todays = payments.filter((p) => istDate(Date.parse(p.created_at)) === today);
  const thisMonth = payments.filter((p) => istDate(Date.parse(p.created_at)).startsWith(month));
  const last7 = payments.filter((p) => Date.parse(p.created_at) >= now - 7 * DAY);
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = istDate(now - (29 - i) * DAY);
    return { date: d.slice(5), amount: Math.round(sum(payments.filter((p) => istDate(Date.parse(p.created_at)) === d))) };
  });

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={300} />
      <PageHeader title="Sales" description="Razorpay payments (captured), refreshed every 15 minutes · read-only" actions={<Badge variant="success">Razorpay connected</Badge>} />
      {error && <Notice>{error}</Notice>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today" value={formatCurrency(sum(todays))} icon={IndianRupee} hint={`${todays.length} payment${todays.length === 1 ? "" : "s"}`} />
        <StatCard label="Last 7 days" value={formatCurrency(sum(last7))} icon={TrendingUp} hint={`${last7.length} payments`} />
        <StatCard label="This month" value={formatCurrency(sum(thisMonth))} icon={CalendarDays} hint={`${thisMonth.length} payments`} />
        <StatCard label="Average payment" value={formatCurrency(payments.length ? sum(payments) / payments.length : 0)} icon={Receipt} hint="last 30 days" />
      </div>
      <Card>
        <CardHeader title="Daily sales" description="Last 30 days" />
        <CardBody>
          <SalesChart data={series} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Recent payments" />
        <ul className="divide-y divide-line px-2 pb-2">
          {payments.slice(0, 25).map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="w-24 shrink-0 font-medium">{formatCurrency(p.amount)}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{p.description || p.email || p.contact || p.id}</span>
              {p.method && <Badge>{p.method}</Badge>}
              <span className="shrink-0 text-[11px] text-subtle">{formatRelative(p.created_at)}</span>
            </li>
          ))}
          {payments.length === 0 && !error && <li className="py-6 text-center text-xs text-subtle">No captured payments in the last 30 days.</li>}
        </ul>
      </Card>
    </div>
  );
}
