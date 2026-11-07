"use server";

import { bookMeeting, type BookingLead } from "@/lib/meetings/book";
import { verifyBookingToken } from "@/lib/meetings/booking-link";
import { formatIst } from "@/lib/meetings/slots";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export interface BookState {
  error?: string;
  bookedAt?: string;
  meetUrl?: string | null;
}

const schema = z.object({
  t: z.string().optional(),
  w: z.string().max(120).optional(),
  start: z.iso.datetime({ message: "Pick a time" }),
  name: z.string().trim().max(120).optional(),
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional(),
  company: z.string().trim().max(160).optional(),
  note: z.string().trim().max(1000).optional(),
  // Honeypot: real visitors never fill this.
  fax: z.string().max(0).optional(),
});

export async function bookSlot(_: BookState, formData: FormData): Promise<BookState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { t, w, start, name, email, company, note } = parsed.data;
  const supabase = createAdminClient();
  if (!supabase) return { error: "Booking isn't available right now. Please reply to our email instead." };

  let orgId: string;
  let lead: BookingLead;
  const leadId = verifyBookingToken(t);
  if (leadId) {
    const { data } = await supabase.from("leads").select("id, org_id, name, company, email, owner_id").eq("id", leadId).maybeSingle();
    if (!data) return { error: "This booking link is no longer valid." };
    orgId = data.org_id as string;
    lead = { id: data.id as string, name: data.name as string, company: data.company as string | null, email: (data.email as string | null) || email || null, owner_id: data.owner_id as string | null };
    if (!data.email && email) await supabase.from("leads").update({ email }).eq("id", data.id);
  } else if (w) {
    if (!name || name.length < 2) return { error: "Please enter your name" };
    if (!email) return { error: "Please enter your work email" };
    const { data: org } = await supabase.from("organizations").select("id").eq("slug", w).maybeSingle();
    if (!org) return { error: "This booking link is no longer valid." };
    orgId = org.id as string;
    const { data: existing } = await supabase.from("leads").select("id, name, company, email, owner_id").eq("org_id", orgId).ilike("email", email).limit(1).maybeSingle();
    if (existing) {
      lead = { id: existing.id as string, name: existing.name as string, company: existing.company as string | null, email: existing.email as string, owner_id: existing.owner_id as string | null };
    } else {
      const { data: owner } = await supabase.from("team_members").select("user_id").eq("org_id", orgId).eq("role", "owner").eq("status", "active").order("created_at").limit(1).maybeSingle();
      const { data: created, error } = await supabase
        .from("leads")
        .insert({ org_id: orgId, name, company: company || null, email: email.toLowerCase(), source: "website", stage: "new", owner_id: owner?.user_id ?? null, ai_score: 70 })
        .select("id, name, company, email, owner_id")
        .single();
      if (error || !created) return { error: "Something went wrong. Please email hello@creativecut.in." };
      lead = created as BookingLead;
      await supabase.from("activities").insert({ org_id: orgId, lead_id: lead.id, type: "system", body: "New lead from the booking page" });
    }
  } else {
    return { error: "This booking link is incomplete." };
  }

  try {
    const meeting = await bookMeeting(supabase, { orgId, lead, start, note });
    return { bookedAt: formatIst(meeting.starts_at as string, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }), meetUrl: meeting.meet_url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't book that time." };
  }
}
