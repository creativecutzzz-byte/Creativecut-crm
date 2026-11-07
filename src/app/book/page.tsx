import { LogoMark } from "@/components/icons";
import { calendar } from "@/lib/integrations/calendar";
import { availableSlots, loadMeetingSettings } from "@/lib/meetings/book";
import { verifyBookingToken } from "@/lib/meetings/booking-link";
import { formatIst } from "@/lib/meetings/slots";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { BookingForm, type DaySlots } from "./booking-form";

export const metadata: Metadata = { title: "Book a call" };
export const dynamic = "force-dynamic";

// Public booking page: /book?t=<personal token> or /book?w=<workspace key>.

export default async function BookPage({ searchParams }: { searchParams: Promise<{ t?: string; w?: string }> }) {
  const { t, w } = await searchParams;
  const supabase = createAdminClient();
  const leadId = verifyBookingToken(t);

  let orgId: string | null = null;
  let firstName = "";
  let needsEmail = false;
  if (supabase && leadId) {
    const { data } = await supabase.from("leads").select("org_id, name, company, email").eq("id", leadId).maybeSingle();
    if (data) {
      orgId = data.org_id as string;
      firstName = data.company && data.company !== data.name ? String(data.name).split(" ")[0]! : "";
      needsEmail = !data.email;
    }
  } else if (supabase && w) {
    const { data } = await supabase.from("organizations").select("id").eq("slug", w).maybeSingle();
    orgId = (data?.id as string | undefined) ?? null;
  }

  let days: DaySlots[] = [];
  let problem: string | null = null;
  let duration = 30;
  if (!supabase || !calendar.isConfigured()) problem = "Online booking isn't set up yet. Please reply to our email and we'll find a time.";
  else if (!orgId) problem = "This booking link isn't valid. Please reply to our email and we'll find a time.";
  else {
    try {
      const settings = await loadMeetingSettings(supabase, orgId);
      duration = settings.duration_minutes;
      const slots = await availableSlots(settings);
      const byDay = new Map<string, DaySlots>();
      for (const s of slots) {
        const day = formatIst(s.start, { weekday: "long", day: "numeric", month: "short" });
        const entry = byDay.get(day) ?? { day, slots: [] };
        entry.slots.push({ start: s.start, label: formatIst(s.start, { hour: "numeric", minute: "2-digit" }) });
        byDay.set(day, entry);
      }
      days = [...byDay.values()];
      if (days.length === 0) problem = "No free slots in the next few days. Please reply to our email and we'll find a time.";
    } catch {
      problem = "Couldn't load the calendar right now. Please try again in a minute, or reply to our email.";
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
      <div className="relative w-full max-w-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="size-11" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">{firstName ? `Hi ${firstName}, pick a time` : "Book a call with Creative Cut"}</h1>
          <p className="mt-1 text-sm text-muted">{duration} minutes on Google Meet · times in IST</p>
        </div>
        <div className="card p-6">
          {problem ? (
            <p className="text-center text-sm text-muted">{problem}</p>
          ) : (
            <BookingForm days={days} token={leadId ? t : undefined} workspace={leadId ? undefined : w} needsDetails={!leadId} needsEmail={needsEmail} />
          )}
        </div>
      </div>
    </main>
  );
}
