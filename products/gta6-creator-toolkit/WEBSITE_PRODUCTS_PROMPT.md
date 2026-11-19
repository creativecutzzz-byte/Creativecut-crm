# Prompt: add a Products section to tools.creativecut.in

Paste the box below into a new Claude Code chat that has the **tools.creativecut.in** repository (Next.js on Vercel).

```text
Add a new, separate "Products" section to tools.creativecut.in (Next.js, deployed on Vercel). Work end to end without asking me: build it, test it, audit it, and deploy it to production. Then send me a short report with the live URLs.

DO NOT BREAK WHAT EXISTS
- Do not change the existing Creative Captions pages, pricing, Razorpay checkout, licence flow or downloads. The Products section is new and separate: new routes, new components, one new nav link.
- Match the site's existing design system (fonts, colours, spacing, buttons, dark/light handling). Reuse existing components where possible.

WHAT TO BUILD
1. A product catalog in ONE config file (e.g. src/data/products.ts), so I can add products later by adding an object. Fields: slug, name, tagline, status ("live" | "coming-soon"), image, priceInr, compareAtInr (optional), priceLabel ("Starts from ₹X" or "₹X"), badge (optional), ctaLabel, ctaUrl (external checkout or internal page), features[] (3-5 short bullets), order.
2. /products: listing page with a responsive grid of product cards (1 column on phones, 2-3 on desktop). Each card shows image, name, one-line tagline, a small price line at the bottom, and a button.
   - Live products: clickable card + button.
   - Coming-soon products: greyed, lock icon, "Coming soon" badge, no price button. Use a "Notify me" email capture (reuse the site's existing waitlist / notify-me mechanism if there is one; otherwise a simple form that stores to the same place the site already uses, with no new paid services).
3. /products/gta-6-creator-toolkit: a full product landing page (this is where Meta ads will send traffic, so it must load fast on mobile and convert).
4. A "Products" link in the main nav and the footer.
5. SEO: title, meta description, Open Graph + Twitter image, canonical URL, schema.org Product JSON-LD with the INR offer, and add both new pages to the sitemap.

PRODUCTS TO ADD
A) Creative Captions (live)
   - Links to the existing /captions page (do not duplicate its content).
   - Price line: "Starts from ₹99" (Basic ₹99 for 31 days, Pro ₹199, Lifetime ₹1,999, taken from the site's current pricing data). Read the price from the existing pricing source in the code if one exists, so it never goes stale.
   - Tagline: "AI captions for After Effects that look edited, not generated."
B) GTA 6 Creator Toolkit (live), an e-book PDF
   - Price: ₹179, shown with ₹199 crossed out and a "10% off" badge. Card price line: "₹179 · PDF".
   - Tagline: "Make your first GTA 6 Short. Just your phone."
   - Features: 36-page phone-first PDF · 7 step-by-step missions · Copy-paste AI prompts + checklists · No game or console needed · Instant download.
   - Product image (cover): https://drive.google.com/file/d/12BPu6p3ENi8Kw22ajBlyQHDwkJ-Qbgn1/view
   - Preview image ("Spot the Rejection"): https://drive.google.com/file/d/1cxT5H_cLkOgdPsMenKehckD43HwtT8aI/view
     (If you can't download them from Drive, use a clean placeholder and list "replace images" in the report. Save images into /public as optimised WebP plus a fallback.)
C) 2-3 "Coming soon" locked cards, e.g. "Caption Presets Pack", "Reels Editing Templates", "Creator Toolkit #2". Lock icon, no price, Notify me.

GTA 6 CREATOR TOOLKIT LANDING PAGE CONTENT (use this copy; plain, honest, no income promises)
- Hero: "You have a 3-hour stream. Where is the 30-second Short?"
  Sub: "Using just your phone, pick the right timestamp, make a vertical edit, and check it against the campaign brief before you submit."
  Price block: ₹199 crossed out, ₹179, "10% off launch price". Button: "Get the GTA 6 Creator Toolkit · ₹179".
- "What's inside": the 7 missions (Choose a campaign · Find three moments · Plan one Short · Edit on a phone · Check the brief · Publish, submit and troubleshoot · Understand three earning routes), plus 2 AI prompts, a submission and reward tracker, a troubleshooting page, a streamer outreach DM, a 7-day practice sprint and an optional console setup.
- "Spot the Rejection" preview: show the preview image with the text "Which clip will fail the campaign brief? Crop A fails: the centre crop cuts off the required overlay. The fix: a stacked layout keeps the full frame on screen." Label it "Preview from the paid PDF · illustrations".
- "You don't need the game or a console. Every exercise works from the PDF using a fictional practice stream."
- "What it is not": "Not a promise of approval, views or income. It teaches a skill and a checklist. Campaign rules and payouts are set by each campaign and change often."
- FAQ: Do I need GTA 6 or a PS5? (No.) Which apps? (Free phone editors like Edits and YouTube Create.) Will I earn money? (Depends on approval, views and rules; no promise.) Language? (Simple English.) Refunds? (show the store's refund policy; if none exists in the repo, write "Contact us within 7 days if the file doesn't open" and list it in the report for me to confirm.)
- Footer line: "Published by Creative Cut. An independent guide, not affiliated with Rockstar Games, Take-Two, Content Rewards, Whop or YouTube."
- Sticky "Buy · ₹179" bar at the bottom on mobile.

CHECKOUT + TRACKING (decide the best setup, implement it, explain it in the report)
- Planned flow: Meta ad → /products/gta-6-creator-toolkit (our page, our pixel) → checkout → PDF delivered.
- Checkout URL comes from config/env: NEXT_PUBLIC_GTA6_CHECKOUT_URL (SuperProfile product link). If it's empty, the buy button opens a "Launching soon, get notified" form instead of a broken link. The page must never show a dead button.
- Pass UTM parameters through: append the visitor's utm_* query params to the checkout URL on click.
- Meta Pixel: load only if NEXT_PUBLIC_META_PIXEL_ID is set. Fire PageView on the new pages, ViewContent on the toolkit page (content_name, value 179, currency INR), and InitiateCheckout on buy click. Do not fire Purchase here (it happens on the checkout platform). Respect any existing consent or analytics setup in the repo.
- Compare two options in the report and recommend one: (1) SuperProfile link-out (fast, no code for payment, but Purchase tracking depends on SuperProfile's pixel support), or (2) reusing the site's existing Razorpay flow for the PDF (own domain, server-side Purchase event, but you'd need to build file delivery). Implement option 1 now. Do not build option 2 unless it's trivial with the existing code.

TEST + AUDIT (all must pass before deploy)
- npm run lint, typecheck and build pass with zero new errors.
- Playwright (or the repo's test setup): /products and /products/gta-6-creator-toolkit render at 375 px and 1280 px, with no horizontal scroll. All buttons and links work. Coming-soon cards are not clickable as purchases. The empty checkout env shows the notify form. A set checkout env opens the URL with UTM params appended.
- Lighthouse mobile on the toolkit page: aim for Performance ≥ 90 and Accessibility ≥ 95. Fix image sizes, alt text, contrast and tap targets.
- Check that existing pages (/, /captions, /pricing) still render and that their checkout buttons are unchanged.

DEPLOY
- Commit on a branch, then merge or deploy to production the way this repo normally ships (Vercel production). Then open the live URLs and confirm they return 200 and render.

REPORT (short)
- Live URLs, what was added, which files changed
- Checkout + tracking setup and your recommendation (option 1 vs 2)
- What I must fill in: NEXT_PUBLIC_GTA6_CHECKOUT_URL (SuperProfile link), NEXT_PUBLIC_META_PIXEL_ID, refund policy text, and real images if placeholders were used
- Test and Lighthouse results
```
