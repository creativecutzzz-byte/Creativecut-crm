# 5. Outreach sequences and personalisation

All of these are built into the CRM. On a lead's page, click **Start sequence** and pick one. The CRM creates a dated task for every step, with the message already filled in. Each morning, open **Tasks**, copy the message, send it from your own inbox or LinkedIn, and tick the task. When someone replies, click **Stop sequence**, which cancels the remaining steps.

Placeholders filled in by the CRM: `{{first_name}}`, `{{company}}`, `{{personalization}}`, `{{sender_name}}`, `{{booking_link}}`, `{{portfolio_link}}`. Set your booking and portfolio links once in **Settings**.

## Channel rules
| Channel | Use for | Rules |
|---|---|---|
| **LinkedIn** | First contact with every prospect | Connect with a note, or no note. Never pitch in the connection request. Max ~20 connection requests a day. |
| **Email** | First contact when you have a published or confirmed work email | Send from a secondary domain (e.g. `creativecut.co.in`), never your main domain. Set up SPF, DKIM and DMARC. Warm the inbox for 2 weeks. Max 30–40 cold emails a day per inbox. Plain text, no images, at most one link. Always include an opt-out line. Gmail's spam-complaint ceiling is 0.3%; aim for under 0.1% ([mailreach.co](https://www.mailreach.co/blog/gmail-sender-guidelines)). |
| **WhatsApp** | **Only** with people who gave you their number or messaged you first (form, call, event) | Cold WhatsApp messaging breaks WhatsApp Business policy and gets numbers banned ([respond.io](https://respond.io/blog/whatsapp-business-banned)). Never import scraped numbers. |

## Personalisation formula
One line, specific to them, that proves you looked. **Observation + why it matters + bridge to video.**

| Bad (generic) | Good (specific) |
|---|---|
| "I love what you're building at RevRag!" | "In-app agents for BFSI onboarding are very visual. A before/after clip of a drop-off being recovered would sell itself." |
| "Congrats on your funding!" | "Congrats on the $6.6M seed from 3one4. 'AI Stack + Software Factory' is three ideas at once, and a 60-second motion explainer can make it click for enterprise buyers." |

Sources for the line, best first: (1) their funding announcement, (2) a recent launch or changelog entry, (3) the founder's last LinkedIn post, (4) the homepage (missing or outdated product video), (5) an open marketing or design role.

**Never** make up a compliment, mention their personal life, or fake familiarity ("as we discussed").

---

## Sequence 1: Cold outreach, funded SaaS (7 steps, 21 days)

**Day 0: LinkedIn connection request (optional note, max 200 characters)**
> Hi {{first_name}}, congrats on the recent news at {{company}}. I run Creative Cut; we make product and launch videos for SaaS teams. Would be good to connect.

**Day 0: Email 1**
Subject: `{{company}} launch videos`
> Hi {{first_name}},
>
> {{personalization}}
>
> We're Creative Cut, a small team that makes product explainers, UI animations and founder videos for SaaS companies as a monthly subscription, so you get launch-ready video every month without briefing a new studio each time.
>
> Would it be useful if I sent over a 15-second animated teaser of one of your product screens? No cost, just to show what it could look like.
>
> {{sender_name}}
> Creative Cut · {{portfolio_link}}
>
> P.S. If this isn't relevant, just reply "no" and I won't follow up.

**Day 2: LinkedIn engagement (task, no message)**
> Like or leave a thoughtful comment on {{first_name}}'s or {{company}}'s most recent post. No pitch.

**Day 3: Email 2**
Subject: `Re: {{company}} launch videos`
> Hi {{first_name}}, a quick follow-up.
>
> The pattern we see with funded SaaS teams: a feature ships, it gets announced with a screenshot, and most of the impact is lost. A 45-second motion video plus two social cut-downs usually does far more for the same launch.
>
> Here's some of our explainer and motion work: {{portfolio_link}}
>
> Happy to make that free teaser if you'd like to see one for {{company}}.
>
> {{sender_name}}

**Day 6: LinkedIn message (if connected)**
> Thanks for connecting, {{first_name}}. Not pitching, just curious: who owns video at {{company}} right now? We're making a few free 15-second product teasers for SaaS teams this month, and happy to do one for you if it'd be useful.

**Day 9: Email 3 (proof)**
Subject: `how we'd do it for {{company}}`
> Hi {{first_name}},
>
> One idea for {{company}}: a 45–60 second motion explainer of your core workflow, then cut into 3–4 short clips for LinkedIn and your launch posts. That's usually what helps buyers understand an AI or SaaS product before a demo call.
>
> We've done 17+ motion and SaaS explainer projects. Examples here: {{portfolio_link}}
>
> If you'd like to talk it through, here's my calendar: {{booking_link}}
>
> {{sender_name}}

**Day 14: Email 4 (low-risk offer)**
Subject: `a fixed-price pilot`
> Hi {{first_name}},
>
> If a subscription feels like too big a step, the way most teams start with us is a single Feature Launch Video: one 45–60s motion video plus social cut-downs, fixed at ₹45,000, delivered in 10 working days. If you continue with a monthly plan, the full amount is credited.
>
> Worth a 15-minute call? {{booking_link}}
>
> {{sender_name}}

**Day 21: Email 5 (close the loop)**
Subject: `closing the loop`
> Hi {{first_name}}, I haven't heard back, so I'll assume video isn't a priority at {{company}} right now, which is completely fine.
>
> I won't email again. If launches pick up later, just reply to this and we'll pick it up from there.
>
> All the best with the next stage,
> {{sender_name}}

---

## Sequence 2: Inbound enquiry (website form, referral, DM)
**Within 1 hour: reply** (email, or WhatsApp if they gave their number on the form)
> Hi {{first_name}}, thanks for reaching out to Creative Cut! I've had a look at {{company}}. Could you share a bit about what you're launching next and roughly when? Easiest is a quick 20-minute call: {{booking_link}}. Or reply here, whichever suits you.
>
> {{sender_name}}

**Day 1: follow-up if no reply**
> Hi {{first_name}}, just making sure this didn't get buried. Here's a selection of SaaS and motion work so you can see the style: {{portfolio_link}}. Happy to work around your calendar: {{booking_link}}

**Day 3: follow-up**
> Hi {{first_name}}, if a call is hard to fit in, reply with your product link and the feature you want to show, and I'll send back a rough approach and a fixed quote.

**Day 7: last touch**
> Hi {{first_name}}, I'll close this for now so it doesn't sit in your inbox. Whenever you're ready, reply here and we'll pick it up.

---

## Sequence 3: Proposal follow-up (starts automatically when a lead moves to "Proposal")
**Day 2**
> Hi {{first_name}}, just checking the proposal came through OK. Any questions on scope or timing that I can answer? Happy to adjust the plan to fit.

**Day 5**
> Hi {{first_name}}, one thing that may help the decision: we can start with the Feature Launch Video pilot (₹45,000, credited to the plan if you continue), so you see the work on {{company}}'s product before committing to a monthly plan.

**Day 9**
> Hi {{first_name}}, is there anyone else at {{company}} who should see the proposal? Happy to join a 15-minute call with them to answer questions.

**Day 14**
> Hi {{first_name}}, should I keep the proposal open or close it for now? Either answer is completely fine; it just helps me plan the team's schedule.

---

## Sequence 4: Booked call no-show
**Same day**
> Hi {{first_name}}, looks like we missed each other today, no problem at all. Here's my calendar to pick another slot: {{booking_link}}

**Day 2**
> Hi {{first_name}}, still keen to help with {{company}}'s launch videos. If the timing's off, just reply "later" and I'll check back next month.

---

## Sequence 5: Re-engage (60 days after "Lost" or no reply)
> Hi {{first_name}}, it's been a couple of months. Has anything changed at {{company}}, such as a new launch or a new hire in marketing? We've just finished a few new product explainers ({{portfolio_link}}). If video is back on the list, happy to send a free 15-second teaser for your latest feature.

---

## Reply handling (copy these)
- **"Send me details"** → "Sure! Here's a one-page overview: [plans]. What are you launching next? I'll tailor the suggestion to that." Then move the lead to *Contacted*.
- **"Not now"** → "Totally understand. When would be a better time to check back, next month or next quarter?" Set the follow-up date on the lead.
- **"We have someone in-house"** → "Makes sense. Many of our clients do. We usually take the motion and explainer work their editor doesn't do, or cover launch peaks. Worth keeping us as a backup?"
- **"How much?"** → Share the plans from section 03 with the pilot price, and suggest the pilot.
- **"Unsubscribe / no"** → "Done, sorry for the interruption, and all the best." Move to *Lost* with the note "opted out". Never contact again.
