import "server-only";

// DEMO DATA — fictional brands and people, used only when the agent has no
// Google Sheet connection (or when you pick a demo scenario). Every screen shows
// a "Demo data" banner while this is in use.

import { buildConnections } from "./connections";
import type { AgentSnapshot, ApiSlot, DemoScenario, Lead, RunRecord, Schedule, Sender } from "./types";

const SAMPLE_SHORT = "https://www.youtube.com/watch?v=-dcbuUzgirI";
const SAMPLE_SAAS = "https://www.youtube.com/watch?v=q-g6Lly4WX0";
const SAMPLE_PODCAST = "https://www.youtube.com/watch?v=FSR7tlrR34Y";
const SAMPLE_REALTY = "https://www.youtube.com/watch?v=eb2IJOaCm7Y";

function body(first: string, req: string, offer: string, label: string, url: string, question: string) {
  return `Hey ${first},\n\nSaw your post about ${req}. ${offer}\n\nHere's one I worked on that's close to what you described: Watch a similar ${label} (${url}).\n\n${question}\n\nHemant\nCreative Cut (https://creativecut.in)\n\nNot relevant? Just reply “no thanks” and I won’t follow up.`;
}

function demoLeads(now: Date, scenario: DemoScenario): Lead[] {
  const iso = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();
  const leads: Lead[] = [
    {
      id: "L-demo01", person: "Riya Kapoor", company: "Brewbox (demo)", reason: "D2C coffee brand asking for a freelance reels editor in Delhi NCR",
      market: "Delhi NCR", niche: "D2C", source: "LinkedIn post", sourceUrl: "https://www.linkedin.com/feed/", postDate: iso(20).slice(0, 10),
      excerpt: "We're hiring a freelance video editor for Instagram Reels — 12 reels a month for our coffee launches. Email careers@brewbox.example",
      research: "Site: Brewbox — specialty coffee subscriptions (demo). Source: brewbox.example", contactChannel: "Email", foundAt: iso(3),
      draft: { attemptId: "A-demo01", to: "careers@brewbox.example", subject: "Edits for your reels", body: body("Riya", "needing a freelance video editor for Instagram Reels", "I can handle the edit and keep the pacing close to what you described.", "short-form reel", SAMPLE_SHORT, "Do you already have a reference for how you want the captions to look?"), sampleTitle: "Talking-head creator reel with captions", sampleUrl: SAMPLE_SHORT, sender: "creativecutzzz@gmail.com", status: "awaiting_approval", problem: null, sentAt: null, edited: false },
    },
    {
      id: "L-demo02", person: "Arjun Mehta", company: "LedgerLoop (demo)", reason: "SaaS startup needs a product demo video with motion graphics",
      market: "India", niche: "SaaS", source: "LinkedIn jobs", sourceUrl: "https://www.linkedin.com/jobs/", postDate: iso(40).slice(0, 10),
      excerpt: "Contract: Motion designer for a 90-second product demo of our invoicing dashboard. Apply at hiring@ledgerloop.example",
      research: "Site: LedgerLoop — invoicing for Indian SMBs (demo).", contactChannel: "Email", foundAt: iso(3),
      draft: { attemptId: "A-demo02", to: "hiring@ledgerloop.example", subject: "LedgerLoop demo edit", body: body("Arjun", "needing a contract motion designer for product demo and animation work", "I can cut the walkthrough and use motion graphics to make each step easier to follow.", "SaaS explainer", SAMPLE_SAAS, "Who's the demo for?"), sampleTitle: "SaaS explainer with bold type animation", sampleUrl: SAMPLE_SAAS, sender: "creativecutzzz@gmail.com", status: "awaiting_approval", problem: null, sentAt: null, edited: false },
    },
    {
      id: "L-demo03", person: "Sana Iqbal", company: "Mindful Minutes Podcast (demo)", reason: "Podcast host wants weekly clips for Shorts and Reels",
      market: "International", niche: "Coaches & creators", source: "Reddit thread", sourceUrl: "https://www.reddit.com/r/HireAnEditor/", postDate: iso(30).slice(0, 10),
      excerpt: "[HIRING] Editor to turn my weekly podcast into 5 clips per episode for Reels and YouTube Shorts. $25/clip. sana@mindfulminutes.example",
      research: "Posted in r/HireAnEditor (demo).", contactChannel: "Email", foundAt: iso(3),
      draft: { attemptId: "A-demo03", to: "sana@mindfulminutes.example", subject: "Clips for your podcast", body: body("Sana", "needing a video editor for Instagram Reels and YouTube Shorts", "I can pull the strongest standalone moments and cut them for Reels and Shorts.", "podcast-style talking-head clip", SAMPLE_PODCAST, "Do you already have the first episodes ready to cut?"), sampleTitle: "Podcast-style talking-head reel", sampleUrl: SAMPLE_PODCAST, sender: "hello.creativecut@gmail.com", status: "awaiting_approval", problem: null, sentAt: null, edited: false },
    },
    {
      id: "L-demo04", person: "Vikram Sethi", company: "Skyline Homes (demo)", reason: "Real estate developer wants property walkthrough reels",
      market: "Delhi NCR", niche: "Real estate", source: "Google search", sourceUrl: "https://www.google.com/", postDate: null,
      excerpt: "Looking for a freelance editor for 3BHK walkthrough reels in Gurugram…", research: "No post date found on the page (demo).", contactChannel: "Email", foundAt: iso(3),
      draft: { attemptId: "A-demo04", to: "info@skylinehomes.example", subject: "Editing for Skyline Homes", body: body("Vikram", "needing a freelance video editor for property videos", "I'd be up for helping with property walkthrough reels.", "property walkthrough reel", SAMPLE_REALTY, "Do you already have footage ready for the first edit?"), sampleTitle: "Builder-floor walkthrough reel", sampleUrl: SAMPLE_REALTY, sender: null, status: "needs_review", problem: "We couldn't confirm when this was posted. Open the source and check it's still open.", sentAt: null, edited: false },
    },
    {
      id: "L-demo05", person: "Neha Bansal", company: "FitFuel (demo)", reason: "Fitness brand looking for a part-time ad creative editor",
      market: "India", niche: "D2C", source: "Instagram post", sourceUrl: "https://www.instagram.com/", postDate: iso(50).slice(0, 10),
      excerpt: "Hiring part-time editor for Meta ad creatives. DM us your portfolio.", research: "Applications by Instagram DM only (demo).", contactChannel: "Instagram DM", foundAt: iso(4), draft: null,
    },
  ];
  if (scenario === "finished") {
    leads.push({
      id: "L-demo06", person: "Kabir Rao", company: "Northstar Studio (demo)", reason: "Agency needs overflow help on talking-head edits",
      market: "International", niche: "Agency", source: "LinkedIn post", sourceUrl: "https://www.linkedin.com/feed/", postDate: iso(70).slice(0, 10),
      excerpt: "Our agency needs a contract editor for 20 talking-head videos this month.", research: "Site: Northstar Studio — creator marketing agency (demo).", contactChannel: "Email", foundAt: iso(26),
      draft: { attemptId: "A-demo06", to: "kabir@northstar.example", subject: "Editing support for Northstar Studio", body: body("Kabir", "needing a contract video editor", "I can take a batch of talking-head reels and work from your existing brand references.", "talking-head reel with captions", SAMPLE_SHORT, "Is this for a single project or recurring support?"), sampleTitle: "Talking-head creator reel", sampleUrl: SAMPLE_SHORT, sender: "creativecutzzz@gmail.com", status: "sent", problem: null, sentAt: iso(22), edited: false },
    });
  }
  return leads;
}

const SCHEDULE: Schedule = { times: ["09:00"], days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], oneTime: null, sendWindow: { start: "10:00", end: "18:00" }, paused: false, timezone: "Asia/Kolkata" };

export function demoSnapshot(scenario: DemoScenario, now: Date): AgentSnapshot {
  const setup = scenario === "setup";
  const running = scenario === "running";
  const senders: Sender[] = setup
    ? [{ slot: 1, email: null, status: "setup_required", dailyCap: 10, sentToday: 0, warmLimit: 5 }, { slot: 2, email: null, status: "setup_required", dailyCap: 10, sentToday: 0, warmLimit: 5 }, { slot: 3, email: null, status: "setup_required", dailyCap: 10, sentToday: 0, warmLimit: 5 }]
    : [
        { slot: 1, email: "creativecutzzz@gmail.com", status: "connected", dailyCap: 6, sentToday: scenario === "finished" ? 1 : 0, warmLimit: 6 },
        { slot: 2, email: "hello.creativecut@gmail.com", status: "connected", dailyCap: 10, sentToday: 0, warmLimit: 5 },
        { slot: 3, email: null, status: "setup_required", dailyCap: 10, sentToday: 0, warmLimit: 5 },
      ];
  const apiSlots: ApiSlot[] = [
    { slot: 1, provider: "web_research", status: "connected", hint: "••••8kQ2", usage: "$0.46 of $5.00 used this month", checkedAt: now.toISOString(), error: null },
    { slot: 2, provider: "apollo", status: setup ? "setup_required" : "needs_reconnect", hint: setup ? null : "••••a91c", usage: null, checkedAt: now.toISOString(), error: setup ? null : "Apollo rejected the saved key (HTTP 401)." },
    { slot: 3, provider: "vibe", status: "setup_required", hint: null, usage: null, checkedAt: null, error: null },
  ];
  const leads = setup ? [] : demoLeads(now, scenario);
  const runs: RunRecord[] = setup
    ? []
    : [
        ...(running ? [{ id: "R-demo-now", startedAt: new Date(now.getTime() - 4 * 60_000).toISOString(), finishedAt: null, trigger: "Run Now", mode: "PREVIEW" as const, result: "running" as const, found: 41, qualified: 0, drafted: 0, sent: 0, skipped: 0, costUsd: 0.06, summary: "Checking contact details", diagnostics: ["LinkedIn posts: Apify run demoRun1 SUCCEEDED, 12 rows, $0.020", "LinkedIn jobs: Apify run demoRun2 SUCCEEDED, 9 rows, $0.014", "Google search: Apify run demoRun3 SUCCEEDED, 20 rows, $0.023"] }] : []),
        { id: "R-demo-0900", startedAt: new Date(now.getTime() - 3 * 3_600_000).toISOString(), finishedAt: new Date(now.getTime() - 2.8 * 3_600_000).toISOString(), trigger: "Schedule", mode: "PREVIEW", result: "with_errors", found: 58, qualified: 5, drafted: 4, sent: 0, skipped: 53, costUsd: 0.1, summary: "Found 5 leads, drafted 4 emails. Apollo was skipped (needs reconnecting).", diagnostics: ["LinkedIn posts: Apify run demoA SUCCEEDED, 12 rows, $0.020", "LinkedIn jobs: Apify run demoB SUCCEEDED, 9 rows, $0.014", "Google search: Apify run demoC SUCCEEDED, 31 rows, $0.022", "Reddit threads: Apify run demoD SUCCEEDED, 6 rows, $0.044", "Apollo enrichment: HTTP 401 Invalid API key"] },
        { id: "R-demo-yday", startedAt: new Date(now.getTime() - 27 * 3_600_000).toISOString(), finishedAt: new Date(now.getTime() - 26.8 * 3_600_000).toISOString(), trigger: "Schedule", mode: "LIVE", result: "succeeded", found: 49, qualified: 3, drafted: 1, sent: 1, skipped: 46, costUsd: 0.09, summary: "Found 3 leads and sent 1 approved email.", diagnostics: ["All sources succeeded", "Gmail: 1 sent from creativecutzzz@gmail.com"] },
      ];
  const statuses = leads.map((l) => l.draft?.status);
  const needsReview = statuses.filter((s) => s === "awaiting_approval" || s === "needs_review").length;
  const snap: AgentSnapshot = {
    backend: "demo",
    demo: { scenario, label: { setup: "First-time setup", running: "Run in progress", finished: "Finished run" }[scenario] },
    mode: setup ? "REVIEW" : "REVIEW",
    sendingLive: false,
    dailyCap: 10,
    run: running ? { running: true, stage: "Checking contact details", startedAt: new Date(now.getTime() - 4 * 60_000).toISOString(), progress: 0.55 } : { running: false, stage: null, startedAt: null, progress: null },
    schedule: SCHEDULE,
    today: { qualified: running ? 0 : leads.filter((l) => l.foundAt > new Date(now.getTime() - 12 * 3_600_000).toISOString()).length, needsReview: running ? needsReview : needsReview, sent: scenario === "finished" ? 0 : 0 },
    leads,
    senders,
    apiSlots,
    connections: [],
    attention: null,
    runs,
    setup: { leadSource: !setup, sender: !setup, previewRun: !setup, mode: !setup },
    sheetUrl: null,
    now: now.toISOString(),
  };
  if (setup) {
    snap.setup = { leadSource: true, sender: false, previewRun: false, mode: false };
  }
  snap.connections = buildConnections(snap);
  if (!setup) snap.attention = { message: "Apollo needs reconnecting", fix: "The saved Apollo key was rejected, so contact lookups were skipped this morning. Paste a fresh key to turn them back on.", actionLabel: "Reconnect", href: "/agent/settings?open=apollo" };
  return snap;
}
