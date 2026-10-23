# 8. Landing page

The page is built at [`landing/index.html`](../landing/index.html): one static file with no build step. Host it at `creativecut.in/saas`, or on its own subdomain such as `saas.creativecut.in`. Its form sends enquiries straight into the CRM as new leads (section 10). It uses the brand from creativecut.in: ink `#0a0a0c`, lime `#c8f53c`, Bebas Neue headings and Satoshi body text.

## Why a separate page
Your main site speaks to everyone ("brands and creators"). Cold outreach and ads to SaaS founders convert better on a page that speaks only to them: their problem, SaaS examples and SaaS pricing.

## Structure and copy
**1. Hero**
- Eyebrow: *Creative subscription for SaaS and AI teams*
- Headline: **Launch videos your buyers actually watch.**
- Sub: Product explainers, UI animation, founder content and ad creatives every month, from one team that learns your product once. Priced in rupees.
- Primary button: *Get a free 15-second teaser* (scrolls to the form) · Secondary: *See plans*
- Proof line: *25+ brands & creators · 43 projects · 17 SaaS & motion explainers*

**2. The problem** (3 cards)
- *Features ship with a screenshot.* Launches deserve more than a static image on LinkedIn.
- *Studios are slow and priced per minute.* ₹50k–₹1L for one explainer, 3–6 weeks, then you brief again.
- *Freelancers need managing.* Missed deadlines, and re-explaining your product every time.

**3. What you get every month**: Motion explainers · UI animation · Founder reels and LinkedIn video · Ad creatives

**4. How it works**: Understand → Plan → Create → Review → Deliver (your existing 5-step process, written for SaaS)

**5. Plans**: Pilot ₹45,000 · Starter ₹55,000 · Growth ₹95,000 (highlighted) · Scale ₹1,60,000, all "+ GST", with "3-month minimum, then month-to-month".

**6. FAQ**: AI tools? · How fast? · What do you need from us? · Minimum term? · Do you write scripts? · GST invoices?

**7. Form (the conversion)**: *Get a free 15-second teaser of your product*
Fields: name, work email, company, website, "What are you launching next?" (optional). Button: **Send me my teaser**. Under the button: "We'll reply within one working day. No spam; we only use your details to reply."

**8. Footer**: WhatsApp link (inbound is fine), email, privacy policy link.

## Rules for any page or ad copy
- No fake numbers, logos or testimonials. Only use client names and logos with written permission.
- Keep proof claims to what the main site already shows (43 projects, 25+ brands and creators, 17 motion/SaaS explainers). Update them when those numbers change.
- One goal per page: the teaser form. Every button points to it.

## Conversion checklist
- [ ] Loads in under 2 seconds on mobile (it's one HTML file with no frameworks)
- [ ] Form works and the lead appears in the CRM (test after every change)
- [ ] Every outreach email's `{{portfolio_link}}` goes to this page or the portfolio
- [ ] Add 2–3 real SaaS work samples as soon as clients approve them
- [ ] Track visits: Vercel Analytics, or Plausible or GA4 if you already use one
