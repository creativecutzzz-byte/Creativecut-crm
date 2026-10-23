// Outreach sequences from playbook/05-outreach-sequences.md. Starting a
// sequence on a lead creates one dated task per step with the message filled
// in; the CRM never sends anything itself. Keep the copy in sync with the
// playbook.

export type SequenceChannel = "email" | "linkedin" | "whatsapp";

export interface SequenceStep {
  day: number;
  channel: SequenceChannel;
  label: string;
  subject?: string;
  body: string;
}

export interface Sequence {
  key: SequenceKey;
  name: string;
  description: string;
  steps: SequenceStep[];
}

export type SequenceKey = "cold_saas" | "inbound" | "proposal" | "no_show" | "reengage";

const SIGN_OFF = "{{sender_name}}";

export const SEQUENCES: Record<SequenceKey, Sequence> = {
  cold_saas: {
    key: "cold_saas",
    name: "Cold outreach: funded SaaS",
    description: "7 touches over 21 days across LinkedIn and email",
    steps: [
      {
        day: 0,
        channel: "linkedin",
        label: "LinkedIn connection request",
        body: "Hi {{first_name}}, congrats on the recent news at {{company}}. I run Creative Cut; we make product and launch videos for SaaS teams. Would be good to connect.",
      },
      {
        day: 0,
        channel: "email",
        label: "Email 1",
        subject: "{{company}} launch videos",
        body: `Hi {{first_name}},

{{personalization}}

We're Creative Cut, a small team that makes product explainers, UI animations and founder videos for SaaS companies as a monthly subscription, so you get launch-ready video every month without briefing a new studio each time.

Would it be useful if I sent over a 15-second animated teaser of one of your product screens? No cost, just to show what it could look like.

${SIGN_OFF}
Creative Cut · {{portfolio_link}}

P.S. If this isn't relevant, just reply "no" and I won't follow up.`,
      },
      {
        day: 2,
        channel: "linkedin",
        label: "LinkedIn engagement (no message)",
        body: "Like or leave a thoughtful comment on {{first_name}}'s or {{company}}'s most recent post. No pitch.",
      },
      {
        day: 3,
        channel: "email",
        label: "Email 2",
        subject: "Re: {{company}} launch videos",
        body: `Hi {{first_name}}, a quick follow-up.

The pattern we see with funded SaaS teams: a feature ships, it gets announced with a screenshot, and most of the impact is lost. A 45-second motion video plus two social cut-downs usually does far more for the same launch.

Here's some of our explainer and motion work: {{portfolio_link}}

Happy to make that free teaser if you'd like to see one for {{company}}.

${SIGN_OFF}`,
      },
      {
        day: 6,
        channel: "linkedin",
        label: "LinkedIn message (if connected)",
        body: "Thanks for connecting, {{first_name}}. Not pitching, just curious: who owns video at {{company}} right now? We're making a few free 15-second product teasers for SaaS teams this month, and happy to do one for you if it'd be useful.",
      },
      {
        day: 9,
        channel: "email",
        label: "Email 3 (proof)",
        subject: "how we'd do it for {{company}}",
        body: `Hi {{first_name}},

One idea for {{company}}: a 45–60 second motion explainer of your core workflow, then cut into 3–4 short clips for LinkedIn and your launch posts. That's usually what helps buyers understand an AI or SaaS product before a demo call.

We've done 17+ motion and SaaS explainer projects. Examples here: {{portfolio_link}}

If you'd like to talk it through, here's my calendar: {{booking_link}}

${SIGN_OFF}`,
      },
      {
        day: 14,
        channel: "email",
        label: "Email 4 (pilot offer)",
        subject: "a fixed-price pilot",
        body: `Hi {{first_name}},

If a subscription feels like too big a step, the way most teams start with us is a single Feature Launch Video: one 45–60s motion video plus social cut-downs, fixed at ₹45,000, delivered in 10 working days. If you continue with a monthly plan, the full amount is credited.

Worth a 15-minute call? {{booking_link}}

${SIGN_OFF}`,
      },
      {
        day: 21,
        channel: "email",
        label: "Email 5 (close the loop)",
        subject: "closing the loop",
        body: `Hi {{first_name}}, I haven't heard back, so I'll assume video isn't a priority at {{company}} right now, which is completely fine.

I won't email again. If launches pick up later, just reply to this and we'll pick it up from there.

All the best with the next stage,
${SIGN_OFF}`,
      },
    ],
  },
  inbound: {
    key: "inbound",
    name: "Inbound enquiry",
    description: "Reply within an hour, then 3 follow-ups over a week",
    steps: [
      {
        day: 0,
        channel: "email",
        label: "Reply within 1 hour",
        body: `Hi {{first_name}}, thanks for reaching out to Creative Cut! I've had a look at {{company}}. Could you share a bit about what you're launching next and roughly when? Easiest is a quick 20-minute call: {{booking_link}}. Or reply here, whichever suits you.

${SIGN_OFF}`,
      },
      {
        day: 1,
        channel: "email",
        label: "Follow-up if no reply",
        body: "Hi {{first_name}}, just making sure this didn't get buried. Here's a selection of SaaS and motion work so you can see the style: {{portfolio_link}}. Happy to work around your calendar: {{booking_link}}",
      },
      {
        day: 3,
        channel: "email",
        label: "Follow-up",
        body: "Hi {{first_name}}, if a call is hard to fit in, reply with your product link and the feature you want to show, and I'll send back a rough approach and a fixed quote.",
      },
      {
        day: 7,
        channel: "email",
        label: "Last touch",
        body: "Hi {{first_name}}, I'll close this for now so it doesn't sit in your inbox. Whenever you're ready, reply here and we'll pick it up.",
      },
    ],
  },
  proposal: {
    key: "proposal",
    name: "Proposal follow-up",
    description: "4 nudges over 14 days; starts automatically at the Proposal stage",
    steps: [
      {
        day: 2,
        channel: "email",
        label: "Proposal check-in",
        body: "Hi {{first_name}}, just checking the proposal came through OK. Any questions on scope or timing that I can answer? Happy to adjust the plan to fit.",
      },
      {
        day: 5,
        channel: "email",
        label: "Offer the pilot",
        body: "Hi {{first_name}}, one thing that may help the decision: we can start with the Feature Launch Video pilot (₹45,000, credited to the plan if you continue), so you see the work on {{company}}'s product before committing to a monthly plan.",
      },
      {
        day: 9,
        channel: "email",
        label: "Other stakeholders",
        body: "Hi {{first_name}}, is there anyone else at {{company}} who should see the proposal? Happy to join a 15-minute call with them to answer questions.",
      },
      {
        day: 14,
        channel: "email",
        label: "Keep open or close?",
        body: "Hi {{first_name}}, should I keep the proposal open or close it for now? Either answer is completely fine; it just helps me plan the team's schedule.",
      },
    ],
  },
  no_show: {
    key: "no_show",
    name: "Booked call no-show",
    description: "Same-day reschedule plus one nudge",
    steps: [
      {
        day: 0,
        channel: "email",
        label: "Reschedule",
        body: "Hi {{first_name}}, looks like we missed each other today, no problem at all. Here's my calendar to pick another slot: {{booking_link}}",
      },
      {
        day: 2,
        channel: "email",
        label: "Nudge",
        body: `Hi {{first_name}}, still keen to help with {{company}}'s launch videos. If the timing's off, just reply "later" and I'll check back next month.`,
      },
    ],
  },
  reengage: {
    key: "reengage",
    name: "Re-engage (60 days later)",
    description: "One message to a lead that went quiet",
    steps: [
      {
        day: 0,
        channel: "email",
        label: "Re-engage",
        body: "Hi {{first_name}}, it's been a couple of months. Has anything changed at {{company}}, such as a new launch or a new hire in marketing? We've just finished a few new product explainers ({{portfolio_link}}). If video is back on the list, happy to send a free 15-second teaser for your latest feature.",
      },
    ],
  },
};

export const SEQUENCE_LIST = Object.values(SEQUENCES);

export const CHANNEL_LABELS: Record<SequenceChannel, string> = { email: "Email", linkedin: "LinkedIn", whatsapp: "WhatsApp" };

export interface SequenceVars {
  first_name: string;
  company: string;
  personalization: string;
  sender_name: string;
  booking_link: string;
  portfolio_link: string;
}

/** Replaces {{placeholders}}. Unknown placeholders are left visible so they get noticed before sending. */
export function renderTemplate(text: string, vars: SequenceVars) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (key in vars ? vars[key as keyof SequenceVars] : match));
}

/** The variables for a lead. Missing values become a bracketed reminder instead of a blank. */
export function sequenceVars(
  lead: { name: string; company: string | null; personalization?: string | null },
  sender: { name: string; bookingUrl: string | null; portfolioUrl: string | null },
): SequenceVars {
  const contactKnown = lead.company ? lead.name.trim().toLowerCase() !== lead.company.trim().toLowerCase() : true;
  return {
    first_name: contactKnown ? (lead.name.split(/\s+/)[0] ?? lead.name) : "there",
    company: lead.company ?? lead.name,
    personalization: lead.personalization?.trim() || "[Add a personalisation line on the lead before sending]",
    sender_name: sender.name || "[Your name]",
    booking_link: sender.bookingUrl || "[Add your booking link in Settings]",
    portfolio_link: sender.portfolioUrl || "[Add your portfolio link in Settings]",
  };
}

/** Task title and description for one step, rendered for a lead. */
export function renderStep(sequence: Sequence, step: SequenceStep, vars: SequenceVars) {
  const index = sequence.steps.indexOf(step) + 1;
  const subject = step.subject ? `Subject: ${renderTemplate(step.subject, vars)}\n\n` : "";
  return {
    title: `${sequence.name} · ${index}/${sequence.steps.length} · ${CHANNEL_LABELS[step.channel]}: ${step.label}`,
    description: subject + renderTemplate(step.body, vars),
  };
}
