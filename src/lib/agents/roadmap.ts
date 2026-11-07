import type { Department } from "./types";

// What the agents page shows for each department: what's live, what's built
// into the CRM already, and what's coming in the next phases
// (docs/ai-sales-system.md).

export const DEPARTMENTS: { key: Department; title: string; blurb: string }[] = [
  { key: "lead_generation", title: "01 · Lead Generation", blurb: "Find, enrich and qualify prospects automatically." },
  { key: "outreach", title: "02 · Outreach", blurb: "Personalised sequences across email, WhatsApp and LinkedIn, with your approval." },
  { key: "sales_calling", title: "03 · Sales Calling", blurb: "Call lists, scripts, meeting booking and call summaries." },
  { key: "crm_operations", title: "04 · CRM Operations", blurb: "Keep the pipeline moving and report on it." },
];

export interface PlannedAgent {
  name: string;
  department: Department;
  status: "built-in" | "phase-2" | "phase-3" | "phase-4";
  note: string;
}

export const PLANNED_AGENTS: PlannedAgent[] = [
  { name: "Instagram & WhatsApp lead capture", department: "lead_generation", status: "built-in", note: "Inbound DMs and messages become leads via the Meta webhook." },
  { name: "Website form capture", department: "lead_generation", status: "built-in", note: "/api/lead-capture" },

  { name: "Approval queue (human oversight)", department: "outreach", status: "built-in", note: "Outreach page: every AI-written message waits for Approve / Edit / Skip." },
  { name: "Email via Google Workspace", department: "outreach", status: "built-in", note: "Outreach Sender: threaded follow-ups, sending hours, daily cap, unsubscribe link." },
  { name: "WhatsApp template touch", department: "outreach", status: "built-in", note: "Outreach Writer adds it for leads with marketing consent." },
  { name: "LinkedIn assistant", department: "outreach", status: "built-in", note: "Writes the connection note and DM; you send it (LinkedIn forbids automation)." },
  { name: "A/B subject tests & reply report", department: "outreach", status: "built-in", note: "Two subject lines per first email; Outreach → Sent shows reply rate per step and variant." },

  { name: "Booking page on Google Calendar", department: "sales_calling", status: "built-in", note: "Personal /book links in every email; Meet link + invite; stage → Meeting booked." },
  { name: "Meeting outcomes", department: "sales_calling", status: "built-in", note: "Held → Proposal (follow-ups start), No-show → reschedule email, Not a fit → closed." },
  { name: "Voice AI (inbound/warm)", department: "sales_calling", status: "phase-4", note: "Vapi/Retell; only consented or inbound leads (TRAI/DND rules)." },

  { name: "Follow-up tracker & reminders", department: "crm_operations", status: "built-in", note: "Sequences, tasks, overdue follow-ups." },
  { name: "Pipeline automation", department: "crm_operations", status: "built-in", note: "Stages move on reply, booking and call outcome; quiet deals get nudge tasks." },
  { name: "Daily brief & weekly report", department: "crm_operations", status: "built-in", note: "Morning email to hello@creativecut.in; Mondays add what's working." },
];
