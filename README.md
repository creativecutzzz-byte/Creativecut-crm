# Creativecut CRM

Sales CRM and go-to-market playbook for **Creativecut**, a video editing agency that turns B2B podcasts into a weekly YouTube edit plus short-form clips.

## What's in here
| Path | What it is |
|---|---|
| `index.html` + `assets/` | The CRM: a web app that runs in the browser, with no install, server or account. Pipeline, leads, automated follow-ups, email templates, client onboarding and a performance dashboard. |
| `playbook/` | The business plan: niche, competitors, offer and pricing, lead generation, cold email, call script, objections, proposal, landing page, content and ads, funnel, onboarding and retention, case studies and KPIs. |
| `tests/` | Unit tests for the CRM logic (`npm test`). |

## Using the CRM
1. Open `index.html` in Chrome, Edge, Firefox or Safari. You can double-click the file, or run `npm start` and visit http://localhost:8080.
2. Go to **Settings** and fill in your name, booking link and portfolio link. These go into every email template.
3. Click **Load demo data** to explore, or **Erase all data** to start clean.
4. Add leads one at a time, or use **Leads → Import CSV** (columns: `name, company, email, channel, niche, source, personalization, website, value`).
5. Open a lead and choose **Enroll → Cold email: podcast founders**. Follow-ups are scheduled for you.
6. Every morning, open **Follow-ups**, click **Write** on each task, send the email and click **Mark sent**.
7. Move leads through the pipeline as they progress (drag the card, or use the Stage selector). Every stage change schedules the right next steps. The full list is in **Sales kit → Automation rules**.

**Your data is stored in this browser only.** Export a backup every week (**Settings → Export backup**). To use the CRM on another computer, restore that backup there. Nothing is sent to any server, and emails are only sent when you send them from your own email app.

### Hosting it online (optional)
It's a static site, so you can publish it with GitHub Pages (Settings → Pages → deploy from this branch) or Vercel. Each browser still keeps its own data. Don't put client data on a public URL unless you add a login (e.g. Vercel password protection or Cloudflare Access).

## 30-day launch plan
| Week | Do this | Playbook |
|---|---|---|
| **1: Foundation** | Confirm the niche; buy 2 sending domains and start warming up inboxes; make 3 spec before/after edits for your portfolio; set up a booking link, Stripe, an agreement template and a one-page site | 01, 03, 04, 08, 12 |
| **2: Pipeline** | Prospect 20 shows a day into a CSV and import it; write personalization lines; enroll 100 leads; cut 5 free sample clips; post content daily | 04, 05, 09 |
| **3: Sell** | Run calls using the script; send proposals within 2 hours; offer founding-client pricing to the first 5 clients; clear follow-ups every morning | 06, 07 |
| **4: Deliver and measure** | Onboard clients with the checklist; deliver the first batch within 7 days; do your first Friday scorecard and fix the weakest funnel stage | 10, 11, 13 |

## Development
```bash
npm test         # unit tests (Node 18+)
npm start        # serve locally at http://localhost:8080 (needs Python 3)
```
- `assets/logic.js`: business rules (stages, automation, sequences, metrics, CSV), with no DOM code.
- `assets/content.js`: email templates, sequences, onboarding checklist, call script and objections. Edit the copy here.
- `assets/app.js`: the user interface.
