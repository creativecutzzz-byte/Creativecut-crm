import "server-only";

import type {
  Activity,
  AdCampaign,
  AdInsightDay,
  Client,
  Integration,
  Lead,
  MessageTemplate,
  TeamMember,
  Workflow,
} from "@/lib/types";

// Sample data for demo mode (no Supabase configured). Dates are relative to
// "now" so the dashboard always looks current.

const DAY = 86_400_000;
const now = () => Date.now();
const daysAgo = (d: number, h = 0) => new Date(now() - d * DAY - h * 3_600_000).toISOString();
const daysAhead = (d: number, h = 0) => new Date(now() + d * DAY + h * 3_600_000).toISOString();

export const demoTeam: TeamMember[] = [
  { id: "tm-1", user_id: "u-1", full_name: "Aanya Kapoor", email: "aanya@creativecut.studio", role: "owner", status: "active", title: "Founder & Creative Director", department: "Leadership", avatar_url: null, open_leads: 4, clients: 3 },
  { id: "tm-2", user_id: "u-2", full_name: "Marcus Lee", email: "marcus@creativecut.studio", role: "admin", status: "active", title: "Head of Growth", department: "Sales", avatar_url: null, open_leads: 6, clients: 2 },
  { id: "tm-3", user_id: "u-3", full_name: "Sofia Martins", email: "sofia@creativecut.studio", role: "manager", status: "active", title: "Account Director", department: "Client Services", avatar_url: null, open_leads: 2, clients: 4 },
  { id: "tm-4", user_id: "u-4", full_name: "Kenji Watanabe", email: "kenji@creativecut.studio", role: "member", status: "active", title: "Video Producer", department: "Production", avatar_url: null, open_leads: 0, clients: 3 },
  { id: "tm-5", user_id: "u-5", full_name: "Leila Haddad", email: "leila@creativecut.studio", role: "member", status: "active", title: "Paid Social Lead", department: "Performance", avatar_url: null, open_leads: 1, clients: 5 },
  { id: "tm-6", user_id: null, full_name: "Diego Alvarez", email: "diego@creativecut.studio", role: "member", status: "invited", title: "Motion Designer", department: "Production", avatar_url: null, open_leads: 0, clients: 0 },
];

export const demoClients: Client[] = [
  { id: "c-1", name: "Nora Bennett", company: "Lumen Skincare", industry: "Beauty", email: "nora@lumenskin.co", phone: "+1 415 555 0142", instagram_handle: "lumenskin", website: "lumenskin.co", status: "active", monthly_retainer: 8500, services: ["Social media", "Paid ads", "Photography"], owner_id: "u-3", started_at: daysAgo(410), health_score: 92 },
  { id: "c-2", name: "Omar Siddiqui", company: "Atlas Fitness", industry: "Fitness", email: "omar@atlasfit.com", phone: "+1 646 555 0188", instagram_handle: "atlasfitclubs", website: "atlasfit.com", status: "active", monthly_retainer: 12000, services: ["Video production", "Paid ads"], owner_id: "u-2", started_at: daysAgo(260), health_score: 84 },
  { id: "c-3", name: "Clara Jensen", company: "Fjord Coffee Roasters", industry: "Food & Beverage", email: "clara@fjordcoffee.com", phone: "+45 20 55 01 77", instagram_handle: "fjordcoffee", website: "fjordcoffee.com", status: "active", monthly_retainer: 4500, services: ["Branding", "Social media"], owner_id: "u-3", started_at: daysAgo(190), health_score: 76 },
  { id: "c-4", name: "Ravi Menon", company: "Helio Solar", industry: "Energy", email: "ravi@heliosolar.io", phone: "+91 98 4555 0123", instagram_handle: "heliosolar", website: "heliosolar.io", status: "onboarding", monthly_retainer: 9500, services: ["Web design", "Paid ads"], owner_id: "u-1", started_at: daysAgo(12), health_score: 70 },
  { id: "c-5", name: "Grace Okafor", company: "Maison Okafor", industry: "Fashion", email: "grace@maisonokafor.com", phone: "+44 20 7946 0331", instagram_handle: "maisonokafor", website: "maisonokafor.com", status: "active", monthly_retainer: 15000, services: ["Video production", "Photography", "Social media"], owner_id: "u-1", started_at: daysAgo(520), health_score: 95 },
  { id: "c-6", name: "Tom Becker", company: "Becker & Sons Realty", industry: "Real Estate", email: "tom@beckerrealty.com", phone: "+1 312 555 0110", instagram_handle: null, website: "beckerrealty.com", status: "paused", monthly_retainer: 3000, services: ["Paid ads"], owner_id: "u-5", started_at: daysAgo(300), health_score: 48 },
  { id: "c-7", name: "Mei Chen", company: "Pebble Pet Co.", industry: "E-commerce", email: "mei@pebblepet.co", phone: "+1 206 555 0199", instagram_handle: "pebblepetco", website: "pebblepet.co", status: "active", monthly_retainer: 6000, services: ["Social media", "Paid ads"], owner_id: "u-5", started_at: daysAgo(150), health_score: 81 },
  { id: "c-8", name: "Hugo Laurent", company: "Vélo Urbain", industry: "Mobility", email: "hugo@velourbain.fr", phone: "+33 1 55 55 01 23", instagram_handle: "velourbain", website: "velourbain.fr", status: "churned", monthly_retainer: 0, services: ["Branding"], owner_id: "u-2", started_at: daysAgo(640), health_score: 22 },
];

export const demoLeads: Lead[] = [
  { id: "l-1", name: "Isabella Rossi", company: "Rossi Trattoria Group", email: "isabella@rossigroup.it", phone: "+39 02 5555 0101", whatsapp_number: "+390255550101", instagram_handle: "rossitrattoria", source: "instagram", stage: "proposal", estimated_value: 36000, service_interest: ["Video production", "Social media"], ai_score: 88, ai_summary: "Three-location restaurant group launching a fourth site in Q1. Asked twice about reels packages; budget confirmed.", ai_next_action: "Send revised proposal with reels add-on before Friday.", owner_id: "u-2", last_contacted_at: daysAgo(1, 3), next_follow_up_at: daysAhead(0, 4), marketing_consent: true, tags: ["hospitality", "hot"], created_at: daysAgo(18) },
  { id: "l-2", name: "Daniel Park", company: "Northwind Apparel", email: "dan@northwind.shop", phone: "+1 503 555 0174", whatsapp_number: null, instagram_handle: "northwindapparel", source: "meta_ads", stage: "qualified", estimated_value: 24000, service_interest: ["Paid ads", "Photography"], ai_score: 79, ai_summary: "DTC apparel brand at ~$2M ARR. Current ROAS 1.8, wants to reach 3+. Decision maker on the call.", ai_next_action: "Book a strategy call with Leila to audit their ad account.", owner_id: "u-2", last_contacted_at: daysAgo(2), next_follow_up_at: daysAhead(1), marketing_consent: true, tags: ["ecommerce"], created_at: daysAgo(9) },
  { id: "l-3", name: "Amara Nwosu", company: "Kora Wellness", email: "amara@korawellness.com", phone: "+234 80 5555 0123", whatsapp_number: "+2348055550123", instagram_handle: "korawellness", source: "whatsapp", stage: "contacted", estimated_value: 14000, service_interest: ["Branding"], ai_score: 64, ai_summary: "Early-stage wellness studio exploring a rebrand. Responded quickly on WhatsApp; timeline is flexible.", ai_next_action: "Share the Fjord Coffee rebrand case study on WhatsApp.", owner_id: "u-1", last_contacted_at: daysAgo(3), next_follow_up_at: daysAhead(0, 2), marketing_consent: true, tags: [], created_at: daysAgo(6) },
  { id: "l-4", name: "Lucas Moreau", company: "Atelier Moreau", email: "lucas@ateliermoreau.fr", phone: null, whatsapp_number: null, instagram_handle: "ateliermoreau", source: "referral", stage: "negotiation", estimated_value: 52000, service_interest: ["Video production", "Branding", "Web design"], ai_score: 91, ai_summary: "Referred by Grace Okafor. Luxury furniture maker needs full brand film + site. Negotiating payment schedule only.", ai_next_action: "Approve a 3-milestone payment plan and send the contract.", owner_id: "u-1", last_contacted_at: daysAgo(0, 5), next_follow_up_at: daysAhead(1, 2), marketing_consent: false, tags: ["luxury", "referral"], created_at: daysAgo(25) },
  { id: "l-5", name: "Priya Shah", company: "Saffron & Sage", email: "priya@saffronsage.com", phone: "+1 718 555 0163", whatsapp_number: "+17185550163", instagram_handle: "saffronandsage", source: "website", stage: "new", estimated_value: 9000, service_interest: ["Social media"], ai_score: 57, ai_summary: "Inbound from the website form. Small catering business; wants monthly content.", ai_next_action: "Reply within 1 hour — inbound leads convert 3× faster.", owner_id: null, last_contacted_at: null, next_follow_up_at: daysAhead(0, 1), marketing_consent: true, tags: [], created_at: daysAgo(0, 2) },
  { id: "l-6", name: "Ethan Brooks", company: "Peak Climbing Gyms", email: "ethan@peakclimb.com", phone: "+1 720 555 0148", whatsapp_number: null, instagram_handle: "peakclimbing", source: "meta_ads", stage: "new", estimated_value: 18000, service_interest: ["Video production", "Paid ads"], ai_score: 72, ai_summary: "Came in via the 'Gym Growth' lead ad. Three gyms, opening a fourth.", ai_next_action: "Call today — high intent ad-form answers.", owner_id: "u-2", last_contacted_at: null, next_follow_up_at: daysAgo(0, 2), marketing_consent: true, tags: ["fitness"], created_at: daysAgo(0, 6) },
  { id: "l-7", name: "Hannah Weber", company: "Weber Dental", email: "hannah@weberdental.de", phone: "+49 30 5555 0190", whatsapp_number: null, instagram_handle: null, source: "website", stage: "contacted", estimated_value: 7500, service_interest: ["Web design"], ai_score: 41, ai_summary: "Wants a site refresh only. Price-sensitive; comparing three agencies.", ai_next_action: "Send the starter web package; low priority.", owner_id: "u-3", last_contacted_at: daysAgo(6), next_follow_up_at: daysAgo(1), marketing_consent: false, tags: [], created_at: daysAgo(14) },
  { id: "l-8", name: "Jamal Wright", company: "Brightside Records", email: "jamal@brightside.fm", phone: "+1 404 555 0137", whatsapp_number: "+14045550137", instagram_handle: "brightsiderecords", source: "instagram", stage: "qualified", estimated_value: 21000, service_interest: ["Video production"], ai_score: 76, ai_summary: "Indie label planning 4 music videos in 2027. Loved the Maison Okafor film.", ai_next_action: "Send production treatment deck and day-rate sheet.", owner_id: "u-1", last_contacted_at: daysAgo(4), next_follow_up_at: daysAhead(2), marketing_consent: true, tags: ["music"], created_at: daysAgo(11) },
  { id: "l-9", name: "Sara Lindqvist", company: "Nordlys Hotels", email: "sara@nordlys.no", phone: "+47 22 55 50 12", whatsapp_number: null, instagram_handle: "nordlyshotels", source: "referral", stage: "proposal", estimated_value: 44000, service_interest: ["Photography", "Video production", "Social media"], ai_score: 83, ai_summary: "Boutique hotel chain, 5 properties. Proposal sent; procurement reviewing.", ai_next_action: "Check in with procurement — no reply in 5 days.", owner_id: "u-3", last_contacted_at: daysAgo(5), next_follow_up_at: daysAgo(0, 1), marketing_consent: true, tags: ["hospitality"], created_at: daysAgo(30) },
  { id: "l-10", name: "Kofi Mensah", company: "Accra Eats", email: "kofi@accraeats.com", phone: null, whatsapp_number: "+233205550144", instagram_handle: "accraeats", source: "whatsapp", stage: "won", estimated_value: 16000, service_interest: ["Social media", "Paid ads"], ai_score: 95, ai_summary: "Signed a 6-month social + ads retainer.", ai_next_action: "Kick off onboarding.", owner_id: "u-5", last_contacted_at: daysAgo(2), next_follow_up_at: null, marketing_consent: true, tags: ["food"], created_at: daysAgo(40) },
  { id: "l-11", name: "Olivia Grant", company: "Grant & Co Law", email: "olivia@grantco.law", phone: "+1 212 555 0122", whatsapp_number: null, instagram_handle: null, source: "website", stage: "lost", estimated_value: 12000, service_interest: ["Branding"], ai_score: 22, ai_summary: "Chose a lower-cost freelancer.", ai_next_action: null, owner_id: "u-3", last_contacted_at: daysAgo(20), next_follow_up_at: null, marketing_consent: false, tags: [], created_at: daysAgo(45) },
  { id: "l-12", name: "Mateo Fernández", company: "Café Origen", email: "mateo@cafeorigen.mx", phone: "+52 55 5555 0177", whatsapp_number: "+525555550177", instagram_handle: "cafeorigen", source: "instagram", stage: "new", estimated_value: 6500, service_interest: ["Social media", "Photography"], ai_score: 49, ai_summary: "DM'd after seeing the Fjord Coffee post. Single location.", ai_next_action: "Reply to the Instagram DM with the starter package.", owner_id: null, last_contacted_at: null, next_follow_up_at: daysAhead(0, 6), marketing_consent: false, tags: [], created_at: daysAgo(1) },
  { id: "l-13", name: "Yuki Tanaka", company: "Sora Skincare", email: "yuki@soraskin.jp", phone: "+81 3 5555 0166", whatsapp_number: null, instagram_handle: "soraskin", source: "meta_ads", stage: "contacted", estimated_value: 28000, service_interest: ["Paid ads", "Social media"], ai_score: 68, ai_summary: "Expanding to the US market. Needs English-language creative + paid social.", ai_next_action: "Schedule a call for Tuesday JST morning.", owner_id: "u-5", last_contacted_at: daysAgo(2), next_follow_up_at: daysAhead(3), marketing_consent: true, tags: ["beauty"], created_at: daysAgo(8) },
  { id: "l-14", name: "Ben Carter", company: "Carter Custom Builds", email: "ben@carterbuilds.com", phone: "+1 615 555 0105", whatsapp_number: null, instagram_handle: null, source: "other", stage: "won", estimated_value: 11000, service_interest: ["Web design"], ai_score: 90, ai_summary: "Signed website build, launch in 6 weeks.", ai_next_action: null, owner_id: "u-2", last_contacted_at: daysAgo(9), next_follow_up_at: null, marketing_consent: false, tags: [], created_at: daysAgo(52) },
];

export const demoActivities: Activity[] = [
  { id: "a-1", type: "stage_change", body: "Atelier Moreau moved to Negotiation", lead_id: "l-4", client_id: null, actor_id: "u-1", created_at: daysAgo(0, 1) },
  { id: "a-2", type: "whatsapp", body: "Amara replied: “Can you share examples of wellness brands?”", lead_id: "l-3", client_id: null, actor_id: null, created_at: daysAgo(0, 3) },
  { id: "a-3", type: "system", body: "New lead from Meta lead ad “Gym Growth” — Peak Climbing Gyms", lead_id: "l-6", client_id: null, actor_id: null, created_at: daysAgo(0, 6) },
  { id: "a-4", type: "meeting", body: "Quarterly review with Lumen Skincare — renewed for 12 months", lead_id: null, client_id: "c-1", actor_id: "u-3", created_at: daysAgo(0, 9) },
  { id: "a-5", type: "instagram", body: "DM from @cafeorigen about social packages", lead_id: "l-12", client_id: null, actor_id: null, created_at: daysAgo(1, 2) },
  { id: "a-6", type: "email", body: "Proposal v2 sent to Rossi Trattoria Group", lead_id: "l-1", client_id: null, actor_id: "u-2", created_at: daysAgo(1, 4) },
  { id: "a-7", type: "task", body: "Kenji completed the Atlas Fitness spring shoot", lead_id: null, client_id: "c-2", actor_id: "u-4", created_at: daysAgo(1, 8) },
  { id: "a-8", type: "stage_change", body: "Accra Eats marked as Won — $16,000", lead_id: "l-10", client_id: null, actor_id: "u-5", created_at: daysAgo(2) },
];

export const demoTemplates: MessageTemplate[] = [
  { id: "t-1", channel: "whatsapp", name: "First touch", body: "Hi {{first_name}}! It's {{owner_name}} from Creative Cut 👋 Thanks for reaching out about {{service}}. Do you have 15 minutes this week for a quick call?", variables: ["first_name", "owner_name", "service"], external_template_name: "first_touch_v1" },
  { id: "t-2", channel: "whatsapp", name: "Proposal nudge", body: "Hi {{first_name}}, just checking you received the proposal for {{company}}. Happy to walk through it whenever suits you.", variables: ["first_name", "company"], external_template_name: "proposal_nudge_v1" },
  { id: "t-3", channel: "whatsapp", name: "Case study share", body: "Hi {{first_name}} — here's a project we think you'll like: {{case_study_url}}. Would something similar work for {{company}}?", variables: ["first_name", "company", "case_study_url"], external_template_name: "case_study_v1" },
  { id: "t-4", channel: "instagram", name: "DM reply — packages", body: "Hey {{first_name}}! Thanks for the message 🙌 Here's an overview of our content packages: {{packages_url}}. Want to hop on a call?", variables: ["first_name", "packages_url"], external_template_name: null },
  { id: "t-5", channel: "instagram", name: "Story mention thanks", body: "Thank you for the mention, {{first_name}}! 💛 We'd love to collaborate — what are you working on next?", variables: ["first_name"], external_template_name: null },
];

export const demoWorkflows: Workflow[] = [
  {
    id: "w-1", name: "Speed-to-lead", description: "Greets every new inbound lead within minutes and assigns an owner.", trigger: "lead_created", trigger_config: { sources: ["website", "meta_ads"] }, is_active: true, runs_last_30d: 42, reply_rate: 0.61,
    steps: [
      { id: "w-1-1", position: 1, action: "send_whatsapp", config: { template: "First touch" } },
      { id: "w-1-2", position: 2, action: "create_task", config: { title: "Call new lead", due_in_hours: 2 } },
      { id: "w-1-3", position: 3, action: "wait", config: { hours: 24 } },
      { id: "w-1-4", position: 4, action: "notify_team", config: { channel: "sales", if: "no_reply" } },
    ],
  },
  {
    id: "w-2", name: "Proposal follow-up", description: "Nudges leads who haven't replied 48h after a proposal is sent.", trigger: "stage_changed", trigger_config: { stage: "proposal" }, is_active: true, runs_last_30d: 11, reply_rate: 0.45,
    steps: [
      { id: "w-2-1", position: 1, action: "wait", config: { hours: 48 } },
      { id: "w-2-2", position: 2, action: "send_whatsapp", config: { template: "Proposal nudge" } },
      { id: "w-2-3", position: 3, action: "wait", config: { hours: 72 } },
      { id: "w-2-4", position: 4, action: "create_task", config: { title: "Personal call — proposal pending", due_in_hours: 4 } },
    ],
  },
  {
    id: "w-3", name: "Instagram DM responder", description: "Replies to new DMs with the packages deck and logs the lead.", trigger: "lead_created", trigger_config: { sources: ["instagram"] }, is_active: false, runs_last_30d: 0, reply_rate: null,
    steps: [
      { id: "w-3-1", position: 1, action: "send_instagram_dm", config: { template: "DM reply — packages" } },
      { id: "w-3-2", position: 2, action: "update_stage", config: { stage: "contacted" } },
    ],
  },
  {
    id: "w-4", name: "Re-engage cold leads", description: "Shares a relevant case study with leads silent for 14 days.", trigger: "no_reply", trigger_config: { no_reply_hours: 336 }, is_active: false, runs_last_30d: 6, reply_rate: 0.17,
    steps: [
      { id: "w-4-1", position: 1, action: "send_whatsapp", config: { template: "Case study share" } },
      { id: "w-4-2", position: 2, action: "wait", config: { hours: 120 } },
      { id: "w-4-3", position: 3, action: "update_stage", config: { stage: "lost", if: "no_reply" } },
    ],
  },
];

export const demoIntegrations: Integration[] = [
  { provider: "whatsapp", status: "disconnected", config: {}, connected_at: null, last_sync_at: null },
  { provider: "instagram", status: "disconnected", config: {}, connected_at: null, last_sync_at: null },
  { provider: "meta_ads", status: "disconnected", config: {}, connected_at: null, last_sync_at: null },
];

export const demoCampaigns: AdCampaign[] = [
  { id: "cmp-1", external_id: "238500001", name: "Atlas Fitness — Spring Membership", client_id: "c-2", objective: "Leads", status: "active", daily_budget: 180 },
  { id: "cmp-2", external_id: "238500002", name: "Lumen Skincare — Serum Launch", client_id: "c-1", objective: "Sales", status: "active", daily_budget: 250 },
  { id: "cmp-3", external_id: "238500003", name: "Pebble Pet — Retargeting", client_id: "c-7", objective: "Sales", status: "active", daily_budget: 90 },
  { id: "cmp-4", external_id: "238500004", name: "Creative Cut — Gym Growth Lead Ad", client_id: null, objective: "Leads", status: "active", daily_budget: 60 },
  { id: "cmp-5", external_id: "238500005", name: "Becker Realty — Open House", client_id: "c-6", objective: "Leads", status: "paused", daily_budget: 70 },
];

// Deterministic pseudo-random so the charts don't jump between renders.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildInsights(days = 30): AdInsightDay[] {
  const profiles: Record<string, { cpm: number; ctr: number; cvr: number; aov: number; leadRate: number }> = {
    "cmp-1": { cpm: 9, ctr: 0.018, cvr: 0.03, aov: 120, leadRate: 0.012 },
    "cmp-2": { cpm: 12, ctr: 0.022, cvr: 0.045, aov: 68, leadRate: 0 },
    "cmp-3": { cpm: 15, ctr: 0.031, cvr: 0.06, aov: 54, leadRate: 0 },
    "cmp-4": { cpm: 8, ctr: 0.014, cvr: 0, aov: 0, leadRate: 0.02 },
    "cmp-5": { cpm: 7, ctr: 0.011, cvr: 0, aov: 0, leadRate: 0.015 },
  };
  const rand = seeded(42);
  const out: AdInsightDay[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const campaign of demoCampaigns) {
    const p = profiles[campaign.id]!;
    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(today.getTime() - d * DAY).toISOString().slice(0, 10);
      // Paused campaign stopped spending ten days ago.
      const live = campaign.status === "active" || d > 10;
      const budget = (campaign.daily_budget ?? 0) * (0.85 + rand() * 0.3) * (live ? 1 : 0);
      const impressions = Math.round((budget / p.cpm) * 1000);
      const clicks = Math.round(impressions * p.ctr * (0.85 + rand() * 0.3));
      const conversions = Math.round(clicks * p.cvr * (0.7 + rand() * 0.6));
      const leads = Math.round(clicks * p.leadRate * (0.7 + rand() * 0.6));
      out.push({
        campaign_id: campaign.id,
        date,
        impressions,
        reach: Math.round(impressions * 0.72),
        clicks,
        spend: Math.round(budget * 100) / 100,
        leads,
        conversions,
        revenue: Math.round(conversions * p.aov * (0.9 + rand() * 0.2)),
      });
    }
  }
  return out;
}

export const demoInsights = buildInsights();

/** Monthly closed revenue and open pipeline for the dashboard trend (last 6 months). */
export function demoRevenueTrend() {
  const revenue = [41200, 46800, 44100, 52900, 58300, 61500];
  const pipeline = [98000, 112000, 121000, 134000, 149000, 167000];
  const current = new Date();
  return revenue.map((value, i) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (revenue.length - 1 - i), 1);
    return {
      month: date.toLocaleString("en-US", { month: "short" }),
      revenue: value,
      pipeline: pipeline[i]!,
    };
  });
}
