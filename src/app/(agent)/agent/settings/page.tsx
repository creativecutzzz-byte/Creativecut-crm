import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { ConnectionsView } from "@/components/agent/connections-view";
import { ModePicker } from "@/components/agent/home-client";
import { SendingToggle } from "@/components/agent/sending-toggle";
import { Card, PageTitle } from "@/components/agent/ui";
import { getSnapshot } from "@/lib/agent/store";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await getSnapshot();
  return (
    <div className="flex flex-col gap-10">
      <div className="-mb-6">
        <PageTitle title="Settings" />
      </div>

      <section aria-labelledby="connections">
        <h2 id="connections" className="mb-1 text-xl font-bold">
          Connections
        </h2>
        <p className="mb-4 text-[15px] text-ag-text-2">Where leads come from and which Gmail addresses send your emails.</p>
        <Suspense>
          <ConnectionsView connections={s.connections} apiSlots={s.apiSlots} senders={s.senders} demo={s.backend === "demo"} />
        </Suspense>
      </section>

      <section id="mode" aria-labelledby="mode-h" className="scroll-mt-20">
        <h2 id="mode-h" className="mb-1 text-xl font-bold">
          Mode and sending
        </h2>
        <p className="mb-4 text-[15px] text-ag-text-2">Decide whether emails wait for you, and whether anything is actually sent.</p>
        <Card className="flex flex-col gap-6 p-6">
          <ModePicker mode={s.mode} />
          <SendingToggle on={s.sendingLive} dailyCap={s.dailyCap} />
        </Card>
      </section>

      {s.sheetUrl ? (
        <a href={s.sheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ag-brand hover:underline">
          Open the full Google Sheet <ExternalLink aria-hidden className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
