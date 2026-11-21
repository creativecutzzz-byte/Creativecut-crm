import { Suspense } from "react";
import { LeadsView } from "@/components/agent/leads-view";
import { PageTitle } from "@/components/agent/ui";
import { getSnapshot } from "@/lib/agent/store";

export const metadata = { title: "Leads" };

export default async function LeadsPage() {
  const s = await getSnapshot();
  return (
    <div>
      <PageTitle title="Leads" />
      <Suspense>
        <LeadsView leads={s.leads} senders={s.senders} mode={s.mode} sendingLive={s.sendingLive} />
      </Suspense>
    </div>
  );
}
