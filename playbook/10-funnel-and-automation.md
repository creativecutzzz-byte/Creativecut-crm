# 10. Sales funnel and CRM automation

## The funnel
```
 ATTRACT                 CAPTURE                    CONVERT                        DELIVER & GROW
 Cold email/DM  ──┐
 LinkedIn content ├──►  Free 2-clip sample   ──►  15-min call  ──►  Proposal  ──►  Onboarding ──► Retain ──► Referral
 Referrals        │     or "book a call" page       (script)        (48h)          (checklist)    (reports,   (day 45)
 Ads (later)    ──┘                                                                                renewal)
```
The **free sample clip** is the centre of the funnel: it is both your outreach hook and your proof of quality.

## What the CRM automates (in `index.html`)
| Trigger | What happens automatically |
|---|---|
| Lead enrolled in a sequence | All steps scheduled on the right days; lead moves to **Contacted** |
| Lead moves to **Replied** | Remaining sequence steps cancelled; "reply within 1 hour" task with a booking template |
| **Call booked** | Call prep task plus a confirmation and agenda email |
| **Proposal sent** | Follow-ups on day 2, day 5 (with an extra free clip) and day 9 (close the loop) |
| **Won** | Welcome and onboarding email, invoice task, kickoff call (day 2), first delivery (day 7), check-in (day 14), testimonial and referral ask (day 45), case-study ask (day 60), and a renewal call 14 days before the 3-month term ends. A 10-item onboarding checklist appears under **Clients**. |
| **Lost** | Re-engagement email in 90 days |
| Client marked **churned** | Remaining client tasks cancelled; win-back email in 30 days |
| Any time | Dashboard shows overdue follow-ups, deals with no activity for 14+ days, and renewals in the next 30 days |

Every automated email opens pre-filled with the lead's details. The CRM warns you about missing personalization and leftover `[PLACEHOLDERS]`, and you send it with one click (it opens your email app) or by copy and paste.

## Running it day to day
- **Morning (15 minutes):** open **Follow-ups** and clear Overdue, then Today. Click **Write**, review the email, send it and mark it sent.
- **When someone replies:** move them to **Replied** immediately so the cold sequence stops.
- **Friday:** export a backup (**Settings → Export backup**). The data lives only in your browser, so back it up weekly.

## Automating the rest
| Repetitive task | Tool | How |
|---|---|---|
| Lead capture from the website form | Zapier or Make | Form → Google Sheet; export to CSV weekly and import into the CRM |
| Booking calls | Cal.com or Calendly | Booking link in Settings (it fills `{{booking_link}}` in every template) |
| Contracts | DocuSign, PandaDoc or Bonsai | Template agreement, sent the same day as the proposal |
| Billing | Stripe subscriptions | Monthly auto-charge; failed-payment emails switched on |
| Client file uploads | Google Drive or Frame.io | One folder per client: `/raw`, `/delivered`, `/brand` |
| Editor workflow | Trello, Notion or ClickUp | Columns: Uploaded → Editing → Internal QA → Client review → Approved → Posted |
| Rough clip selection | Opus Clip, Descript, Riverside | First pass by AI; the human editor chooses and polishes |
| Captions | CapCut, Descript, Submagic | Template per client, using their brand fonts and colours |
| Posting | Metricool, Buffer, Later | For Studio clients |
| Weekly numbers | This CRM's dashboard | Screenshot every Friday into your weekly review |

**When to move to a hosted CRM:** once you have 2+ salespeople, or more than about 1,000 active leads, or you need email sending and open tracking built in, move to HubSpot (free tier) or Pipedrive. Your CSV export imports directly.
