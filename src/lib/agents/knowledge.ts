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
