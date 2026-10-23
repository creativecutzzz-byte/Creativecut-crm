# 10. Sales funnel and CRM automation

## The funnel
```
 Prospect ─► Outreach ─► Teaser / reply ─► Discovery call ─► Proposal ─► Pilot or plan ─► Onboarding ─► Monthly delivery ─► Renewal, upgrade, referral
  (04)         (05)          (05)               (06)            (07)         (03)            (11)              (11)                 (11)
```
| Stage in the CRM | Means | Entry action | Exit when |
|---|---|---|---|
| **New** | Researched, not yet contacted | Import CSV or add a lead, with a personalisation line | First message sent |
| **Contacted** | Sequence running | Start **Cold outreach** or **Inbound enquiry** | They reply (stop the sequence) or the sequence ends |
| **Qualified** | Replied positively, fits the ideal customer profile | Book the discovery call | Call held |
| **Proposal** | Proposal sent | Move to Proposal → **follow-ups start automatically** | They decide |
| **Negotiation** | Discussing scope, price or timing | — | Signed or lost |
| **Won** | Paid the pilot or the first month | **Convert to client** → onboarding checklist created | — |
| **Lost** | Said no, went silent after every sequence, or opted out | Note the reason. Opt-outs are never contacted again. | Re-engage after 60 days (unless they opted out) |

## What the CRM automates
| Trigger | What happens automatically |
|---|---|
| Website form submitted (landing page) | Lead created (source *Website*, owner = workspace owner), enquiry saved to its timeline, high-priority task **"Reply to website enquiry within 1 hour"** |
| **Start sequence** on a lead | One dated task per step, assigned to the lead's owner, with the message already written using the lead's name, company and personalisation line plus your booking and portfolio links. Any running sequence is replaced. |
| **Stop sequence** | All remaining steps cancelled, logged on the timeline |
| Lead moved to **Proposal** | Cold, inbound, no-show and re-engage sequences stopped; **Proposal follow-up** started (days 2, 5, 9 and 14). It won't start twice. |
| Lead moved to **Won** or **Lost** | Every open sequence step cancelled |
| **Convert to client** | Client created; lead marked Won; sequences stopped; **14-day onboarding checklist** (9 tasks) created on the client |
| New client added with status *Onboarding* | Same onboarding checklist |
| Every month | A **"Monthly report"** task for each active or onboarding client, due on the 25th (created the first time anyone opens the CRM that month, never duplicated) |
| **Import CSV** | Leads created with their personalisation line; research columns saved as a note; duplicates skipped |

**What the CRM never does:** send emails, LinkedIn messages or WhatsApp messages. You send each one yourself from your own inbox or app, which keeps you within the rules in section 05, and you stay in control of every word.

## Daily routine in the CRM (20 minutes, every morning)
1. **Tasks → My tasks.** Work top to bottom: overdue first, then today's.
2. For each sequence step: open **Message**, check the personalisation, click **Copy message**, send it, then tick the task.
3. Got a reply? Open the lead, click **Stop** on the sequence, log the reply (Log activity → Email, or Note for LinkedIn), and move the stage forward.
4. Check **Leads → Overdue** for anything without a next step.

## Setup checklist (one time)
- [ ] **Settings → Outreach links:** booking link and portfolio link (used in every message)
- [ ] **Settings → Website lead capture:** copy the endpoint and workspace key into `landing/index.html`
- [ ] **Leads → Import CSV:** `playbook/prospects-2026-10.csv`, then add each contact's name from LinkedIn (Edit lead)
- [ ] Invite teammates (Team), so leads and tasks can be assigned to them

## Tracking
- **Dashboard → Conversion funnel:** added → contacted → proposal → won for the last 90 days. Compare with the targets in section 13.
- **Dashboard → Win rate, Monthly retainers (MRR), Open pipeline**
- **Clients → Account health** (update monthly)
