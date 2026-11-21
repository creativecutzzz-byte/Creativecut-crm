import { ScheduleView } from "@/components/agent/schedule-view";
import { PageTitle } from "@/components/agent/ui";
import { getSnapshot } from "@/lib/agent/store";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const s = await getSnapshot();
  return (
    <div>
      <PageTitle title="Schedule" />
      <ScheduleView initial={s.schedule} now={s.now} />
    </div>
  );
}
