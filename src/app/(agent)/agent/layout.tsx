import type { Metadata, Viewport } from "next";
import { AgentShell } from "@/components/agent/shell";
import { sheetConfigured } from "@/lib/agent/google-cloud";
import { getSnapshot } from "@/lib/agent/store";

export const metadata: Metadata = { title: { default: "Lead Agent", template: "%s · Lead Agent" } };
export const viewport: Viewport = { themeColor: "#f7f6f1" };
export const dynamic = "force-dynamic";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  let snap;
  try {
    snap = await getSnapshot();
  } catch (e) {
    return (
      <div className="agent-app grid min-h-dvh place-items-center p-6">
        <div className="max-w-md rounded-2xl border border-ag-rule bg-ag-card p-6">
          <h1 className="text-xl font-bold">The Lead Agent can&apos;t reach its Google Sheet</h1>
          <p className="mt-2 text-ag-text-2">{e instanceof Error ? e.message : "Please try again in a minute."}</p>
        </div>
      </div>
    );
  }
  return (
    <AgentShell needsReview={snap.today.needsReview} previewOnly={!snap.sendingLive} demo={snap.demo} snapshotAt={snap.backend === "snapshot" ? (snap.snapshotAt ?? null) : null} canUseLive={sheetConfigured()} running={snap.run.running}>
      {children}
    </AgentShell>
  );
}
