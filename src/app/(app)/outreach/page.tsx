import { DraftCard } from "@/components/outreach/draft-card";
import { QueueActions } from "@/components/outreach/queue-actions";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getOutreachQueue, getViewer, type OutreachView } from "@/lib/data";
import { gmail } from "@/lib/integrations/gmail";
import { isMessagingLive } from "@/lib/integrations";
import { cn } from "@/lib/utils";
import { CheckCircle2, Inbox, Send, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Outreach" };

const VIEWS: { key: OutreachView; label: string }[] = [
  { key: "pending", label: "Needs approval" },
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
  { key: "closed", label: "Skipped / cancelled" },
];

export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: raw } = await searchParams;
  const view = (VIEWS.some((v) => v.key === raw) ? raw : "pending") as OutreachView;
  const [viewer, queue] = await Promise.all([getViewer(), getOutreachQueue(view)]);
  const canApprove = viewer.mode === "live" && ["owner", "admin", "manager"].includes(viewer.role);
  const pendingEmails = view === "pending" ? queue.drafts.filter((d) => d.channel === "email" && d.kind === "sequence" && d.status === "pending").length : 0;
  const live = isMessagingLive();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outreach"
        description="AI-written messages wait here for your approval. Approved emails go out from your Google Workspace mailbox inside sending hours."
        actions={canApprove ? <QueueActions pendingEmails={pendingEmails} canWrite={viewer.role === "owner" || viewer.role === "admin"} /> : undefined}
      />

      {(!gmail.isConfigured() || !live) && (
        <Notice icon={Send}>
          {!gmail.isConfigured() ? (
            <>
              <strong className="font-medium">Gmail isn&apos;t connected.</strong> Set up the Google Workspace service account (docs/google-workspace-setup.md) so
              approved emails can be sent and replies read.{" "}
            </>
          ) : null}
          {!live ? (
            <>
              <strong className="font-medium">Dry-run mode:</strong> approving records the message but delivers nothing until <code>MESSAGING_MODE=live</code>.
            </>
          ) : null}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Needs approval" value={String(queue.counts.pending)} icon={Inbox} />
        <StatCard label="Scheduled" value={String(queue.counts.scheduled)} icon={Send} />
        <StatCard label="Emails sent today" value={String(queue.sentToday)} icon={CheckCircle2} />
        <StatCard label="Leads on autopilot" value={String(queue.activeLeads)} icon={Users} />
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "pending" ? "/outreach" : `/outreach?view=${v.key}`}
            className={cn("-mb-px border-b-2 px-3 py-2 text-xs", view === v.key ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {v.label} <span className="text-subtle">({queue.counts[v.key]})</span>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {queue.drafts.map((d) => (
          <DraftCard key={d.id} draft={d} canApprove={canApprove} />
        ))}
      </div>
      {queue.drafts.length === 0 && (
        <p className="py-10 text-center text-sm text-subtle">
          {view === "pending" ? "Nothing to approve. Turn on the Outreach Writer on the AI Agents page, or start autopilot from a lead." : "Nothing here yet."}
        </p>
      )}
    </div>
  );
}
