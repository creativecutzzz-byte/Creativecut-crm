// Knowledge layer: what every agent knows about Creative Cut.
// Source of truth: playbook/01-niche-and-icp.md and playbook/03-offer-and-pricing.md.
// Kept as one stable string so it is cached across Claude calls.

export const COMPANY_KNOWLEDGE = `
# Creative Cut
A video and motion-design studio (creativecut.in) selling monthly content plans.
Proof: 17 motion / SaaS explainer projects and 10 video-editing projects.

## Ideal customer (primary niche)
Funded Indian B2B SaaS and AI startups, Seed to Series B, that ship features
often and need product and launch content every month. Buyers: founders,
co-founders, CEO, head of marketing / growth / brand, product marketing.
City doesn't matter (remote delivery): Bengaluru, Pune, Mumbai, Delhi NCR,
Hyderabad, Chennai. Strong signals: a recent funding round, a new feature or
product launch, hiring for marketing, a LinkedIn-heavy founder, an outdated or
missing product video on the website.

## Second niche (from month 4)
Real-estate developers (project-launch videos, ads).

## Not a fit
D2C/consumer brands chasing cheap UGC, clinics, restaurants, gyms, tiny local
shops, agencies (competitors), companies with no product to show.

## Offer
- Pilot: Feature Launch Video — one 45–60 s motion video + 9:16 and 1:1 cuts,
  ₹45,000 + GST, 10 working days, fully credited against a plan.
- Plans (3-month minimum): Starter ₹55,000/mo (8 shorts + 1 motion ≤30 s),
  Growth ₹95,000/mo (12 shorts + 1 explainer ≤60 s + 4 ad variants),
  Scale ₹1,60,000/mo (20 shorts + 2 motion pieces + 10 ad variants).
- Promise: short-form in 72 hours, feature videos in 10 working days, one team
  that already knows the product.

## Services we can recommend
"Feature launch video", "Product explainer", "Founder content / reels",
"UI animation", "Ad creatives", "Video editing".

## Tone for outreach
Short, specific, founder-to-founder. Reference something real about them
(the round, a feature, their site). No hype, no buzzwords, no fake flattery.
`.trim();

// Condensed from playbook/06-sales-call-and-objections.md, for call prep.
export const CALL_PLAYBOOK = `
# Discovery call (25 min): understand, then recommend one plan. They talk 70%.
1. Open: agenda — understand what they're launching and how video works today, show 2 close examples, recommend; say so if it's not a fit.
2. Situation: what ships in the next 3 months; how video is made today (in-house / freelancers / studio / none); who owns content and signs off.
3. Problem: how the last launch was announced; what's frustrating (slow, re-briefing, quality, cost, nobody owns it); what the next launch looks like if nothing changes.
4. Impact: how prospects first understand the product; what proper launch video would change for sales/fundraising; any deadline (event, launch, board meeting).
5. Show: two 30–60 s portfolio pieces close to their product.
6. Recommend and close: Pilot (₹45k, credited) / Starter / Growth based on what they said; offer to send the proposal today; ask who else needs to see it. Book the next step before hanging up.

# Common objections (Acknowledge → Ask → Answer)
- Too expensive: compare with ₹50k–1L per studio explainer; Growth = explainer + 12 shorts + ads for ₹95k; Starter or pilot if tight.
- Freelancer: continuity and range, one team that knows the product, agreed turnarounds.
- Hiring in-house: cover the gap, then stay for motion/explainers; month-to-month after 3 months.
- AI tools: great for walkthroughs; the story (what to show, for which buyer) is what makes it work.
- Not enough content: one launch = explainer + 4–6 cut-downs; founder clips from existing calls; pilot/Starter if low volume.
- "Send a proposal": ask if the question is budget, timing or fit; book a time to discuss.
- Need co-founder: what will they ask; offer a 15-min call with both.
- Free sample: the 15 s teaser; pilot is the paid trial with a redo guarantee.
- 3-month minimum: month 1 is learning the product; pilot has no commitment.
`.trim();
