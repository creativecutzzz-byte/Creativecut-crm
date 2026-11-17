# Outreach Engine build guide

> Text extracted from `docs/outreach-engine/Outreach-Engine-Build-Guide.pdf` (the original). How it maps onto this repo: `docs/outreach-engine/README.md`.

```text
Build an Automated Outreach Engine with Claude
Code, Google Workspace and Vercel
A step-by-step build guide based on the Arkyniq Outreach Engine demo · Prepared November 2026

This guide shows you how to build a system that researches 3,000–5,000 leads a week, qualifies them against your ideal
customer profile (ICP), writes a personalised plain-text email for each one, sends it from a fleet of warmed Google
Workspace mailboxes, and tracks follow-ups and replies on a live dashboard. You direct Claude Code and it writes most of
the code. Each step includes the tool setup and a prompt you can paste into Claude Code.



What you are building

Every week the system does the following with no manual work:

1. Ingest 3,000–5,000 raw leads from a CSV, Google Sheet or API.
2. Verify and qualify each lead against your ICP.
3. Research each qualified prospect by reading their own website.
4. Draft a short, personalised plain-text email.
5. Fact-check the draft: every company-specific claim must be backed by a quote that appears word for word on the
   prospect’s site.
6. Send one email at a time from a pool of mailboxes, in the prospect’s local morning, on weekdays only.
7. Follow up in the same thread, and stop the moment a human replies.
8. Classify every reply (interested, not now, wrong person, unsubscribe) and show everything on a dashboard.


Design principles taken from the demo
   Plain text, no tracking. No open pixels and no wrapped links. Replies are the only metric that counts.
   Fact-checked personalisation. An invented compliment is worse than a generic email, so the quality gate rejects it
   automatically.
   Many small senders. 10 domains × 3 mailboxes. Each domain has its own reputation, its own 120/day cap and its own
   warm-up ramp, so one flagged domain never takes down the rest.
   Human pacing. One email at a time per mailbox with a random 45–180 second gap.
   Automatic brakes. Rules pause a mailbox or a domain on their own when bounces or complaints rise.
   Model fallback. If one AI model is busy or fails, the lead falls through to the next model in a chain.


Capacity planning

 Item                                                             Planning number

 New leads researched per week                                    3,000–5,000

 Share that survives qualification and the quality gate           about 40–60% (your rate will differ)

 First emails per week                                            about 1,500–2,500

 Total sends per week including follow-ups                        about 3,000–6,000

 Fleet                                                            10 domains × 3 mailboxes = 30 mailboxes

 Caps                                                             40 per mailbox and 120 per domain per day

 Fleet capacity                                                   about 1,200 per weekday, roughly 6,000 per week


These are planning assumptions, not guarantees. Start far below them while the mailboxes warm up (Step 2).
Architecture and the role of each tool

 Tool                       Role in the system

 Claude Code                Builds and maintains the codebase from your specs. You review; it writes, runs and fixes code.

 Claude API                 Runs inside the product: qualification, research extraction, drafting and reply classification.

 Google Workspace           Sending infrastructure: domains, mailboxes, the Gmail API for sending and reading, Calendar for
                            meetings, Postmaster Tools for reputation.

 Vercel                     Hosts the dashboard, the API routes and the scheduler (cron).

 Postgres                   Single source of truth. Neon (through the Vercel Marketplace) or Supabase both work.

 Lead source and            Apollo, Clay or Apify for leads; ZeroBounce, NeverBounce or a similar service for verification.
 email verifier

 Registrar and DNS          Cloudflare or Namecheap for the sending domains.


How data moves through the system:

  Lead upload -> verify -> ICP qualify -> research -> draft -> quality gate -> ready queue
                                                                                   |
  Scheduler tick (every minute) -> each mailbox picks ONE due email -> Gmail API send -> wait 45-180s
                                                                                   |
  Reply poller -> classify -> stop sequence / notify you / add to suppression list


  Deliverability guard watches bounces and complaints and pauses mailboxes or domains


Recommended code stack: Next.js (App Router) with TypeScript, Postgres, the official Anthropic SDK and the
googleapis package.



Before you start

Accounts and access

   A Claude subscription or API access for Claude Code, plus an Anthropic API key for the calls your system makes at
   runtime.
   A Google Workspace account where you are Super Admin.
   A free Google Cloud project (for the Gmail API).
   A Vercel Pro plan. The free Hobby plan only allows cron jobs that run once per day and is meant for personal, non-
   commercial use, so it cannot run a per-minute scheduler for a business. (Checked November 2026; confirm on Vercel’s
   pricing page.)
   A Postgres database, a GitHub account, Node.js 20 or newer and Git on your computer.
   About ten domains, an email-verification service and a lead source.
Costs to budget for: domains (yearly), Workspace (per mailbox per month, which adds up across 30 mailboxes), Vercel
Pro (per seat per month), the database, verification credits, lead data and Claude API usage for thousands of leads a week.
Get current prices from each vendor before you commit.


Compliance first
Cold email at this volume is only sustainable when it is relevant, honest and easy to stop. Build these rules in from day one.
This is not legal advice, so have a lawyer review the regions you target.
   Honest sending. Use real sender names of people at your company, accurate subject lines, your genuine business
   identity, and no fake “Re:” threads.
   Opt-out always works. Add a plain-text opt-out line and a List-Unsubscribe header, and put every opt-out on a
   suppression list that the sender checks before every email.
   Region rules differ. US CAN-SPAM allows B2B cold email with an opt-out and a physical postal address in the message.
   The UK and EU (GDPR, PECR), Canada (CASL) and some individual countries are stricter. Keep a country allow-list in your
   config and only send to regions you have cleared.
   Google’s sender rules. Authenticate every domain with SPF, DKIM and DMARC. Google asks senders to keep their
   spam rate below 0.1% and never reach 0.3%, and a Workspace user is limited to 2,000 messages and 3,000 external
   recipients per day. Limits can change, so check Google’s current documentation.
   Data hygiene. Only use lead data you are allowed to use, respect robots.txt when fetching prospect sites, and delete
   data on request.
If your list is poorly targeted, no infrastructure will save your domains. Targeting quality is the real deliverability strategy.



Step 1 — Set up Claude Code and the project

Install and sign in
1. Install Node.js 20 or newer and Git.
2. Install Claude Code using the instructions in Anthropic’s Claude Code documentation. The npm route is npm install -g
   @anthropic-ai/claude-code .
3. Open a terminal in your project folder, run claude , and sign in with your Claude account when prompted.


Create the project

  mkdir arkyniq-outreach && cd arkyniq-outreach
  git init
  npx create-next-app@latest . --typescript --app --tailwind --eslint
  npm install googleapis @anthropic-ai/sdk pg zod yaml
  claude



Write CLAUDE.md, the project’s memory
Claude Code reads a CLAUDE.md file at the root of the repo at the start of each session. Put your non-negotiable rules there
so every change respects them.


  # Outreach Engine


  ## Goal
  Weekly pipeline: import leads -> verify -> ICP qualify -> research -> draft ->
  quality gate -> send -> follow up -> classify replies.


  ## Stack
  Next.js App Router (TypeScript), Postgres, Anthropic SDK, googleapis. Deployed on Vercel.


  ## Hard rules
  - Emails are plain text. No tracking pixels and no wrapped links.
  - Every company-specific claim needs an evidence quote that appears verbatim on the prospect page.
  - One email at a time per mailbox, random 45-180 second gap.
  - Weekdays only, inside the recipient local morning window.
  - Never send to an address on the suppression list. Check it again right before sending.
  - A human reply stops that lead sequence immediately.
  - Secrets come from environment variables only. Never log or commit them.
  - Every cron route must verify the CRON_SECRET bearer token.
  - Write tests for: quality gate, send window, suppression, stop-on-reply.


  ## Layout
  app/(dashboard)/    dashboard pages
  app/api/cron/       scheduler routes
  lib/db/             schema, migrations, queries
  lib/gmail/          auth, send, poll
  lib/research/       fetch, extract, draft, gate
  lib/guard/          deliverability rules
Working habits that save hours
   Ask Claude Code to plan before coding for each step below, then approve the plan.
   Commit after every working step so you can roll back.
   Keep secrets in .env.local and make sure it is listed in .gitignore .
   Ask for tests for every rule in CLAUDE.md and run them before deploying.
   Build against a sandbox mailbox and your own test addresses first, never real prospects.



Step 2 — Domains and the mailbox fleet

Why separate domains
Reputation is tracked per domain. Spreading sending across 10 domains, each capped at 120 emails a day, contains any
problem to one domain. Keep your primary company domain out of cold outreach entirely.


Buy and prepare the domains
1. Buy about 10 lookalike domains of your brand at a registrar (for example getbrand.com, trybrand.com, brandhq.co).
   Choose names that clearly point to your real company.
2. Point each domain’s website to your main site (a simple redirect works) so a prospect who checks it lands on something
   real.
3. Keep all DNS with one provider, such as Cloudflare, so you manage every record in one place.


Add the domains to Google Workspace
1. Open the Admin console, then Account → Domains → Manage domains → Add a domain.
2. Choose a secondary domain and verify ownership with the TXT record Google gives you.
3. Add the MX record or records that the Admin console shows for Google Mail.


Authenticate every domain (SPF, DKIM, DMARC)

 Record    Where                Value

 SPF       TXT on the root       v=spf1 include:_spf.google.com ~all
           domain

 DKIM      TXT at               Generate it in the Admin console under Apps → Google Workspace → Gmail → Authenticate
           google._domainkey    email. Create a 2048-bit key, publish it, then click Start authentication.

 DMARC     TXT at _dmarc        Start with v=DMARC1; p=none; rua=mailto:dmarc@yourmaindomain.com and move to
                                 p=quarantine once the reports look clean.


Check each domain with a free tool such as MXToolbox. Then send a test email to a personal Gmail address, open Show
original, and confirm that SPF, DKIM and DMARC all say PASS.


Create the mailboxes
1. In Directory → Users, create 3 users per domain (30 in total). Bulk upload from a CSV is available.
2. Use real people at your company as sender names, and make sure someone actually reads those inboxes.
3. Give each user a profile photo and a plain-text signature with your company name, plus a real postal address if your
   target regions require one.
4. Decide where replies go. Either read each inbox through the Gmail API (Step 8) or forward to a shared inbox.


Watch reputation with Postmaster Tools
Add each sending domain to Google Postmaster Tools and verify it with a DNS record. It shows domain reputation and spam
rate for mail sent to personal Gmail accounts. The guard rules in Step 9 use this as a signal.


Warm up before real volume
A new domain that suddenly sends 40 emails a day gets filtered. Ramp gradually, and only increase when bounces and
spam-folder placement stay low.
 Week                        Sends per mailbox per day                                 Domain total per day

 1                           5–10                                                      15–30

 2                           15–20                                                     45–60

 3                           25–30                                                     75–90

 4 onward                    up to 40                                                  up to 120


Warm-up can be done with a dedicated warm-up service or with a slow ramp of real, well-targeted emails to verified leads.
Store each mailbox’s ramp stage in the database. The sender (Step 7) reads its allowed cap from there, so you never hand-
edit limits.



Step 3 — Google Cloud service account for the Gmail API

One service account can send and read mail as any of your 30 mailboxes through domain-wide delegation.

1. Open the Google Cloud console and create a project.
2. Go to APIs & Services → Library and enable the Gmail API (and the Google Calendar API if you want meeting
     detection).

3. Go to IAM & Admin → Service Accounts, create a service account and add a JSON key. Download it once.
4. Copy the service account’s numeric Client ID from its details page.

5. In the Workspace Admin console open Security → Access and data control → API controls → Manage Domain
     Wide Delegation → Add new. Paste the Client ID and these scopes:
         https://www.googleapis.com/auth/gmail.send

         https://www.googleapis.com/auth/gmail.readonly

6. Base64-encode the JSON key and store it as the GOOGLE_SA_KEY_B64 environment variable. Never commit the key file.

Auth code that acts as one mailbox:


            import { google } from 'googleapis';


            export function gmailFor(mailbox: string) {
                const key = JSON.parse(Buffer.from(process.env.GOOGLE_SA_KEY_B64!, 'base64').toString());
                const auth = new google.auth.JWT({
                 email: key.client_email,
                 key: key.private_key,
                 scopes: [
                      'https://www.googleapis.com/auth/gmail.send',
                      'https://www.googleapis.com/auth/gmail.readonly',
                 ],
                 subject: mailbox, // the mailbox to act as
                });
                return google.gmail({ version: 'v1', auth });
            }



Prompt for Claude Code


  Create lib/gmail/auth.ts that exports gmailFor(mailbox). It must use a Google service
  account with domain-wide delegation, reading GOOGLE_SA_KEY_B64 from env. Then add a script
  scripts/test-send.ts that sends a plain-text test email from one mailbox to an address I
  pass on the command line and prints the Gmail message id and thread id.


Run the test script and confirm that one mailbox can send before you build anything else.



Step 4 — Database and data model

Create a Postgres database (from the Vercel dashboard use Storage → Marketplace, or create one in Supabase) and store
its URL as DATABASE_URL . These tables drive every screen in the demo dashboard.


          create table domains (
           id serial primary key,
           name text unique not null,
           status text not null default 'warming',    -- warming | active | paused
           daily_cap int not null default 120,
           paused_reason text
          );


          create table mailboxes (
           id serial primary key,
           domain_id int references domains(id),
           email text unique not null,
           status text not null default 'warming',    -- warming | active | paused
           daily_cap int not null default 10,         -- raised by the warm-up ramp
           ramp_started_on date not null default current_date,
           next_send_at timestamptz not null default now(),
           paused_reason text
          );


          create table leads (
           id bigserial primary key,
           email text unique not null,
           first_name text, last_name text, title text,
           company text, website text, country text, timezone text,
           source text, segment text,
           status text not null default 'uploaded',
           -- uploaded | verified | qualified | disqualified | researched | ready
           -- | in_sequence | replied | bounced | unsubscribed | completed
           icp_score int, icp_reason text,
           created_at timestamptz default now()
          );


          create table pages (
           url text primary key,
           text text,
           fetched_at timestamptz default now()
          );


          create table research (
           lead_id bigint primary key references leads(id),
           evidence_quote text, evidence_url text,
           facts jsonb, gate_passed boolean,
           model text, duration_ms int, created_at timestamptz default now()
          );


          create table steps (
           id bigserial primary key,
           lead_id bigint references leads(id),
           step_no int not null,                      -- 1 = first email, 2 and 3 = follow-ups
           subject text, body text,
           due_at timestamptz,                        -- earliest send time
           status text not null default 'ready',      -- ready | sent | skipped | failed
           mailbox_id int references mailboxes(id),
           gmail_message_id text, gmail_thread_id text, rfc_message_id text,
           sent_at timestamptz,
           unique (lead_id, step_no)
          );
          create table replies (
            id bigserial primary key,
            lead_id bigint references leads(id),
            mailbox_id int references mailboxes(id),
            gmail_message_id text unique,
            received_at timestamptz,
            body text,
            is_auto boolean default false,
            intent text,   -- interested | not_now | not_interested | wrong_person | referral | unsubscribe | question
            created_at timestamptz default now()
          );


          create table suppression (
            email text primary key,
            reason text,   -- unsubscribed | bounced | complaint | manual
            created_at timestamptz default now()
          );


          create table events (
            id bigserial primary key,
            type text, payload jsonb, created_at timestamptz default now()
          );



Prompt for Claude Code


  Create docs/schema.sql with the schema above and a migration runner (npm run migrate) using
  the pg package. Add typed query helpers in lib/db for: claiming leads for a pipeline stage
  with FOR UPDATE SKIP LOCKED, counting today's sends per mailbox, and checking the
  suppression list.


The FOR UPDATE SKIP LOCKED claim pattern matters later: it lets several serverless runs work in parallel without ever picking
the same lead twice.



Step 5 — Lead intake, verification and ICP qualification

Define the ICP as data
Keep your ICP in config/icp.yaml so qualification is repeatable and Claude Code can edit it safely. Replace every value with
your own.


          industries: [B2B SaaS, Digital agencies]
          employee_range: [10, 200]
          target_titles: [Founder, CEO, Head of Growth, VP Sales]
          allowed_countries: [US, CA, GB]    # also your compliance allow-list
          exclude: [competitors, students, consumer-only businesses]
          min_score: 70



Intake and cleaning
1. Accept a CSV upload on a dashboard page, or read a Google Sheet through the Sheets API. Required columns: email,
   first_name, company, website. Optional: last_name, title, country.
2. Normalise the rows: lowercase and trim the email, derive the domain, and dedupe against existing leads.
3. Reject anything on the suppression list, role addresses (info@, sales@), free-mail addresses if you only want business
   contacts, and countries outside the allow-list.
4. Send the remaining addresses to your verification service in batches. Keep only valid ones and treat risky or catch-all
   addresses as a separate low-priority segment, or drop them. Hard bounces damage reputation, so keep your bounce
   rate low (many senders aim to stay under about 2%).
Qualify against the ICP in two layers
1. Rules first (free and instant): title match, country allow-list, company-size range.
2. AI scoring for the fuzzy criteria: fetch the homepage, cache the text in the pages table so each page is only fetched
   once, and ask Claude to score the fit. Use a small, fast model here to keep cost down.


  You are screening leads against an ideal customer profile.
  ICP: {contents of config/icp.yaml}
  Lead: {title} at {company} ({country}).
  Website text: {first 3000 characters of the homepage}


  Return JSON only: {score: 0-100, qualified: true or false, reason: one sentence}
  Score high only when the page text supports the fit. If you are unsure, score below 50.


Validate the JSON with zod. If parsing fails, retry once, then mark the lead for manual review instead of guessing. Leads at
or above min_score become qualified ; the rest become disqualified with the reason stored in icp_reason , which also
feeds your segment analytics.
Prompt for Claude Code


  Build the intake pipeline. 1) POST /api/leads/upload accepts a CSV, normalises and dedupes
  rows, applies the suppression list, role-address and country rules, and inserts leads with
  status uploaded. 2) A function verifyLeads() batches addresses to the verification API
  (provider and key from env) and sets status verified or disqualified. 3) A function
  qualifyLeads() applies the rules in config/icp.yaml, fetches and caches the homepage in the
  pages table (respect robots.txt, 10s timeout, 1 retry), asks Claude for a JSON score, validates
  it with zod, and sets qualified or disqualified. Add tests for the rule layer.




Step 6 — Research engine and the quality gate

This is the heart of the system. For each qualified lead it reads the prospect’s own website, finds one true and specific thing
worth mentioning, drafts the email, and proves the claim before the email is allowed to go out.


What happens for each lead
1. Fetch. Pull the homepage plus one or two useful pages from the same domain (about, blog, case studies, careers). Strip
   the HTML to plain text and cache it in the pages table. Skip pages that robots.txt disallows or that fail to load.
2. Extract. Ask Claude for the single most relevant observation that connects to your offer, plus the exact sentence from
   the page that supports it ( evidence_quote ) and its URL.
3. Draft. Ask Claude to write the email using only that observation.
4. Gate. Check that the quote appears word for word in the cached page text. A pass moves the lead to ready . A fail
   triggers one retry with feedback. A second fail means the lead is skipped (the safest choice) or receives a clearly generic
   email with no company-specific claims.
The drafting prompt

  You write short cold emails for {your company}, which sells {one-line offer}.
  Prospect: {first_name}, {title} at {company}.
  Pages from their site (verbatim text):
  {page text, trimmed to about 6000 characters}


  Task:
  1. Pick ONE specific, true observation from the page text that relates to our offer.
  2. Copy the sentence that supports it EXACTLY as written on the page into evidence_quote.
  3. Write the email using only that observation. 60-110 words, plain text, no links.
     One observation, one sentence on why it matters to them, one easy question.
     No invented numbers, no flattery that is not in the evidence, no false urgency.
  If nothing on the page supports a specific observation, set evidence_quote to null and
  write a short, honest, generic email that makes no claims about their company.


  Return JSON only: {evidence_quote, evidence_url, subject, body}


The opt-out line and the signature are added by code at send time, not by the model, so they can never be forgotten or
reworded.


The quality gate
The gate is plain code, not another opinion from the model. It normalises both strings (lowercase, punctuation and
whitespace collapsed) so that curly quotes or line breaks never cause a false failure, then checks for an exact match.


          const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();


          export function quotePasses(quote: string | null, pageText: string): boolean {
              if (!quote) return true; // generic email: tag it generic and track its reply rate
              const q = norm(quote);
              return q.split(' ').length >= 6 && norm(pageText).includes(q);
          }



Run three checks on every draft:

1. Quote check. The function above. The six-word minimum stops a one-word quote from passing trivially.
2. Faithfulness check. A cheap second model call: “Does every company-specific claim in this email follow directly from
   this quote? Answer yes or no.” Anything other than yes fails. The quote check proves the quote is real; this proves the
   email does not stretch it.
3. Hygiene check. No links, no leftover placeholders such as {first_name} , word count in range, subject under about 8
   words, no all-caps words.

Write a test that feeds the gate a fabricated quote that is not on the page and confirms it fails. It is the most important test
in the project.


Model chain with fallback
Define the chain in an environment variable, for example MODEL_CHAIN=claude-sonnet-5-5,claude-haiku-5-5 (check
Anthropic’s model documentation for current model IDs, and add a model from another provider if you want a cross-vendor
fallback). When a model is overloaded, rate-limited or times out, the lead falls through to the next model. Record which
model wrote each draft in research.model ; the dashboard’s model-chain panel reads it.
          const chain = (process.env.MODEL_CHAIN ?? '').split(',');


          export async function draftWithFallback(prompt: string) {
              for (const model of chain) {
                  try {
                      const res = await anthropic.messages.create({
                       model,
                       max_tokens: 700,
                       messages: [{ role: 'user', content: prompt }],
                      });
                      const block = res.content[0];
                      return { model, text: block.type === 'text' ? block.text : '' };
                  } catch (err) {
                      await logEvent('model_failed', { model, error: String(err) }); // try the next model
                  }
              }
              throw new Error('all models in the chain failed');
          }



Throughput and the ready-copy runway
At 5,000 leads a week you research about 1,000 a day. Each lead takes roughly 10–40 seconds (page fetches plus two or
three model calls), so do not process leads one by one inside a single run. Each cron tick should claim a small batch (for
example 8 leads with FOR UPDATE SKIP LOCKED ) and process them in parallel with Promise.allSettled , finishing well inside
the function time limit.
Track the ready-copy runway: the number of ready emails divided by your daily send capacity. Keep at least two days of
runway so sending never starves. If it falls, raise the batch size or add a second research cron.
Prompt for Claude Code


  Build lib/research. 1) fetchPage(url) with robots.txt check, 10s timeout, text extraction and
  caching in the pages table. 2) researchLead(leadId) that fetches up to 3 pages, calls the
  model chain (MODEL_CHAIN env) with the drafting prompt in docs/prompts/draft.md, parses JSON
  with zod, then runs quotePasses, a faithfulness check and a hygiene check. On pass, insert
  research and create steps 1-3 as ready. On fail, retry once with the failure reason, then
  skip the lead. 3) POST-protected route app/api/cron/research that claims 8 leads with
  FOR UPDATE SKIP LOCKED and processes them in parallel. Add tests, including a fabricated
  quote that must fail the gate.




Step 7 — The sending engine

The sender is deliberately boring and careful. It never loops or sleeps; each cron tick looks at every mailbox and sends at
most one email from each mailbox that is due.


The rules, in order
1. Pick only mailboxes that are active or warming , whose next_send_at has passed and whose sends today are below the
   allowed cap. The allowed cap is the smaller of the mailbox’s ramp cap and what is left of its domain’s 120/day.
2. Claim one due step with FOR UPDATE SKIP LOCKED and flip it to sending in the same transaction, so two runs can never
   send it twice. Add sending to the allowed status values.
3. Check the recipient-local window: Monday to Friday, roughly 8:00–11:00 in the lead’s time zone (derive the time zone
   from the country or city, with a sensible fallback). Outside the window, put the step back and move on.
4. Re-check the suppression list and the lead’s status immediately before sending. Anything other than qualified , ready
   or in_sequence is skipped.
5. Build the plain-text message, send it through the Gmail API as that mailbox, and store the Gmail message id, thread id
   and RFC Message-ID.
6. Set mailbox.next_send_at = now + random(45, 180) seconds , mark the lead in_sequence and schedule the next step’s
   due_at .
Building and sending the message

          import { randomInt } from 'crypto';


          function rawMessage(m: {
              from: string; to: string; subject: string; body: string; messageId: string;
              inReplyTo?: string; unsubMailto: string; unsubUrl: string;
          }) {
              const headers = [
                `From: ${m.from}`,
                `To: ${m.to}`,
                `Subject: ${m.subject}`,
                `Message-ID: ${m.messageId}`,
                `List-Unsubscribe: <mailto:${m.unsubMailto}>, <${m.unsubUrl}>`,
                'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
                'MIME-Version: 1.0',
                'Content-Type: text/plain; charset=UTF-8',
              ];
              if (m.inReplyTo) headers.push(`In-Reply-To: ${m.inReplyTo}`, `References: ${m.inReplyTo}`);
              return Buffer.from(headers.join('\r\n') + '\r\n\r\n' + m.body).toString('base64url');
          }


          const res = await gmailFor(mailbox.email).users.messages.send({
              userId: 'me',
              requestBody: { raw, threadId: previousThreadId }, // threadId only on follow-ups
          });
          const nextGapSeconds = randomInt(45, 181); // 45 to 180 seconds



What the body looks like
The model writes the middle of the email. Code wraps it: a greeting with the first name, the body, a plain-text signature,
and a closing opt-out line such as “If this is not relevant, reply ‘no’ and I will not email again.” Add your postal address in
the signature if your target regions require it.


The unsubscribe endpoint
Create /api/unsubscribe that accepts a signed token (an HMAC of the lead id using UNSUB_SECRET ) so nobody can
unsubscribe other people. It must handle both the one-click POST from the List-Unsubscribe-Post header and a simple GET,
add the address to suppression , and mark the lead unsubscribed . Serve it from a domain you control and test it from a real
Gmail inbox.


Errors
   Gmail quota or rate errors: pause that mailbox for 24 hours and record an event.
   Authentication or “account suspended” errors: pause the mailbox and alert immediately.
   Temporary 5xx errors: put the step back as ready and retry on a later tick.

Prompt for Claude Code


  Build lib/gmail/send.ts and app/api/cron/send. Each run: for every sendable mailbox whose
  next_send_at has passed and whose sends today are below min(ramp cap, remaining domain cap),
  claim ONE ready step due now with FOR UPDATE SKIP LOCKED (set status sending in the same
  transaction), enforce the recipient-local Mon-Fri 8:00-11:00 window using the lead timezone,
  re-check suppression and lead status, send plain text via the Gmail API with Message-ID,
  List-Unsubscribe and List-Unsubscribe-Post headers, store gmail ids, set next_send_at to
  now plus a random 45-180 seconds, and schedule the next step. Add /api/unsubscribe with
  HMAC-signed tokens. Add tests for the window logic, caps and double-send protection.
Step 8 — Replies, classification and follow-ups

Detect replies
Poll every mailbox every 2–3 minutes. The efficient method is the Gmail history API: store a history_id per mailbox (add
the column to mailboxes ) and ask only for what changed since then. Match each new inbound message to a lead through its
 threadId , and ignore messages sent by your own mailboxes. Gmail push notifications through Pub/Sub are the real-time
alternative, but polling is simpler and enough to start.


Filter bounces and auto-replies
   Bounces: messages from mailer-daemon or postmaster, or a delivery-status report. Parse the failed address, mark the
   lead bounced , add hard bounces to suppression , and record an event for the guard.
   Auto-replies: an Auto-Submitted header other than no , an X-Autoreply header, Precedence: auto_reply , bulk or
   junk , or subjects such as “Out of office” and “Automatic reply”. Save them with is_auto = true , do not classify them,
   and do not let them stop the sequence.


Classify every human reply
Before calling the model, run a deterministic check for opt-out phrases (stop, remove me, unsubscribe, do not contact). A
match goes straight to suppression, so an opt-out never waits on an AI call. For everything else use a small, fast model:

  Classify this reply to a cold email into exactly one intent:
  interested, question, not_now, not_interested, wrong_person, referral, unsubscribe.
  If the sender names another person to contact, also return referral_name and referral_email.
  Reply text: {body without the quoted thread}
  Return JSON only: {intent, referral_name, referral_email, summary: one sentence}



 Intent                 What the system does

 interested, question   Stop the sequence, notify you (Slack or email) and label the thread. A human answers, quickly.

 not_now                Stop the sequence and tag the lead to revisit in 60–90 days.

 not_interested         Stop the sequence. No further emails.

 wrong_person,          Stop the sequence. If a referred contact is named, add them as a new lead that goes through normal
 referral               qualification.

 unsubscribe            Stop the sequence and add to the suppression list.


Every human reply stops the sequence. In one transaction, set the lead to replied and every remaining step for that
lead to skipped .


The follow-up sequence
   Generate steps 1–3 together when the research passes the gate. Step 2 is due three business days after step 1 and step
   3 about five business days after step 2.
   Follow-ups are two to four sentences. They may add a new angle but must not add new company-specific claims,
   because only the step-1 evidence was verified.
   Send follow-ups from the same mailbox and in the same thread by reusing the thread id and setting In-Reply-To and
   References from the previous step. A “Re:” subject is appropriate here because it genuinely is a reply in an existing
   thread.
   Immediately before each follow-up, fetch that thread once and confirm there is no new reply. This closes the gap
   between polls.
   If a mailbox is paused, its follow-ups simply wait. Step 1 is not tied to a mailbox until it is sent, so other mailboxes pick it
   up.


Meetings
Give interested prospects a booking link (a Google Calendar appointment schedule or a scheduling tool of your choice).
Mark a lead as meeting when a calendar event with that lead as an attendee appears (Calendar API), or add a manual
button on the dashboard. This feeds the last stage of the funnel.
Prompt for Claude Code

 Build app/api/cron/replies. For each mailbox use the Gmail history API with a stored history_id
 (add the column) to find new inbound messages. Match threads to leads, ignore our own
 mailboxes, detect bounces and auto-replies by headers, run a deterministic opt-out phrase
 check, then classify other replies with a small model and validate the JSON with zod. Apply
 the actions in docs/reply-actions.md in a single transaction, including skipping all remaining
 steps. Update the sender so every follow-up re-checks its thread for new replies first.
 Add tests for stop-on-reply and auto-reply handling.
Step 9 — The deliverability guard

The guard reads recent results and pauses a mailbox or domain before a problem spreads. The thresholds below are
starting points to tune against your own data. They are not Google rules.

 Signal                                              Threshold                                      Automatic action

 Mailbox hard bounces                                2% or more of the last 100 sends (minimum      Pause the mailbox
                                                     30 sends)

 Domain hard bounces                                 2% or more of the last 200 sends               Pause the domain

 Gmail quota or rate error                           Any                                            Pause the mailbox for 24 hours

 Authentication, suspension or suspicious-           Any                                            Pause the mailbox and alert
 activity error                                                                                     immediately

 Negative replies (opt-outs and angry                1% or more of the domain’s last 300 sends      Pause the domain
 replies)

 Postmaster Tools spam rate                          0.1% or more                                   Halve the domain’s daily cap

 Postmaster Tools spam rate                          0.3% or more                                   Pause the domain

 Postmaster Tools domain reputation                  Drops to Low or Bad                            Pause the domain

 Reply rate                                          Under half of its 7-day median across 150 or   Alert only
                                                     more sends


How to build it:
   Run /api/cron/guard every 5 minutes. It calculates the numbers from steps , replies and events , sets status =
   'paused' with a paused_reason , logs an event and posts an alert to Slack or email.

   Never auto-resume. A person reviews the cause and resumes from the dashboard.
   Postmaster Tools numbers can be entered by hand once a day or pulled through its API. Either way, store them so the
   guard can read them.
   When a domain is paused, its unsent first emails move to other domains automatically. Follow-ups in existing threads
   wait for that mailbox.

Prompt for Claude Code

  Build lib/guard and app/api/cron/guard implementing the rules table in docs/guard-rules.md.
  Thresholds must live in config/guard.yaml, not in code. On a breach set the mailbox or domain to
  paused with a reason, insert an events row, and post to ALERT_WEBHOOK_URL. Add a dashboard
  action to resume. Write tests that simulate bounces and confirm the right mailbox pauses.




Step 10 — Scheduler and deployment on Vercel

Define the cron jobs
Create vercel.json at the project root. Research and sending run every minute, reply polling every 3 minutes and the
guard every 5. Cron schedules run in UTC.


            {
                "crons": [
                    { "path": "/api/cron/research", "schedule": "* * * * *" },
                    { "path": "/api/cron/send", "schedule": "* * * * *" },
                    { "path": "/api/cron/replies", "schedule": "*/3 * * * *" },
                    { "path": "/api/cron/guard", "schedule": "*/5 * * * *" }
                ]
            }



Every-minute schedules need the Pro plan. On Hobby, deployment fails with an error saying Hobby accounts are limited to
daily cron jobs.
Protect and harden every route
If you set a CRON_SECRET environment variable, Vercel sends it to your cron routes as a bearer token. Reject everything else:


            export async function GET(req: Request) {
                if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
                    return new Response('Unauthorized', { status: 401 });
                }
                // do ONE small batch of work, then return
                return Response.json({ ok: true });
            }



Design rules for serverless jobs:

   Small batches, no sleeping. The random 45–180 second gap is stored in next_send_at , never waited out inside a
   function.
   Idempotent everywhere. A job can run twice or overlap with the next tick. The SKIP LOCKED claims, the sending
   status and the unique (lead_id, step_no) constraint make that harmless.
   Log an event for every send, failure and pause. The dashboard’s live feed reads them.


Environment variables

 Variable                                         Purpose

  DATABASE_URL                                    Postgres connection string

  ANTHROPIC_API_KEY                               Runtime Claude calls

  MODEL_CHAIN                                     Comma-separated model IDs in fallback order

  GOOGLE_SA_KEY_B64                               Base64-encoded service account key

  CRON_SECRET                                     Random string of 32 or more characters

  UNSUB_SECRET                                    Signs unsubscribe tokens

  VERIFY_API_KEY                                  Email verification provider

  ALERT_WEBHOOK_URL                               Slack incoming webhook or similar

  ALLOWED_LOGIN_DOMAIN                            Workspace domain allowed to open the dashboard


Deploy
1. Push the repo to GitHub.
2. In Vercel choose Add New → Project, import the repo and keep the Next.js preset.
3. Under Settings → Environment Variables, add every variable above for Production.
4. Attach Postgres from the Marketplace (or paste your Supabase URL) and run npm run migrate against production once.
5. Deploy, then confirm the four jobs appear under Settings → Cron Jobs. Trigger each once with curl and the bearer
   token and check the events table.
6. Point your unsubscribe domain at the project and test the link from a real inbox.


Protect the dashboard
The dashboard shows lead data and replies, so it must never be public. Add sign-in with Google restricted to your
Workspace domain ( ALLOWED_LOGIN_DOMAIN ), which fits neatly with the rest of this stack.
Prompt for Claude Code


  Create the four cron routes (research, send, replies, guard) with CRON_SECRET bearer
  verification, vercel.json, and a /api/health route. Add Google sign-in restricted to the
  ALLOWED_LOGIN_DOMAIN for all dashboard pages through middleware. Write a README section
  listing every environment variable and the deploy steps.
Step 11 — The dashboard

Each panel in the demo maps to a simple query on your tables.

 Panel                                                         Data source

 Fleet status (domains, healthy mailboxes, capacity)            domains and mailboxes status; capacity is the sum of allowed
                                                               caps

 Today’s send window (sent of cap, next send countdown,         steps sent today, the earliest mailboxes.next_send_at , replies
 replies, interested, meetings)                                today

 Emails sent per day with replies, interested and meetings      steps grouped by date over 7, 30 or 90 days, joined to replies
                                                               by intent

 Pipeline funnel                                               Lead counts by stage: uploaded, verified, qualified, researched,
                                                               sent, replied, interested, meeting

 Reply intent                                                   replies by intent , excluding is_auto

 When people reply                                              replies by recipient-local hour and weekday (a heatmap)

 Where sends go                                                 steps by leads.country

 Mailbox fleet                                                 Per mailbox and domain: sent today, cap, ramp stage, status,
                                                               bounce rate

 Research engine                                               Researched today, average duration_ms , queue size, ready-copy
                                                               runway

 Model chain                                                    research.model counts per day for the last 14 days

 Live activity                                                  events with filters for replies, sends, research and issues

 Deliverability                                                Each guard rule with its current value and status

 Segment performance                                            leads.segment : sends, replies, interested, meetings and reply
                                                               rate, sortable


Keep it fast: refresh every 30 seconds, offer 7, 30 and 90 day ranges, and support light and dark themes. Open a reply
thread from the live feed so you can answer interested prospects immediately.
Prompt for Claude Code


  Build the dashboard in app/(dashboard) using Tailwind and Recharts. One page with sections:
  fleet status, today send window, emails per day chart, funnel, reply intent, reply heatmap,
  send regions, mailbox fleet table, research engine stats, model chain chart, live activity
  feed with filters, deliverability rules and a sortable segment table. Use server-side queries
  in lib/db/analytics.ts, 7/30/90 day range selector, 30 second refresh, light and dark theme.
  Show only data we actually have; no fake numbers.




Go-live checklist

☐ Every domain passes SPF, DKIM and DMARC, and is verified in Postmaster Tools.

☐ A test email from each mailbox reaches the inbox at Gmail, Outlook and a Workspace address.

☐ The warm-up ramp is enforced by code and reads from the database.
☐ The suppression list is tested end to end: List-Unsubscribe link, one-click POST and a reply saying stop.

☐ Stop-on-reply is tested with a dummy lead, including a reply that arrives just before a follow-up.
☐ The quality gate rejects a fabricated quote.

☐ The guard pauses a mailbox when you simulate bounces.

☐ The country allow-list matches the regions you have cleared with legal advice.
☐ The dashboard sits behind login and every secret lives only in Vercel environment variables.
☐ Pilot: run 50 real leads and read every draft yourself, then 200, then scale toward your weekly target.
Weekly operating rhythm

   Monday: upload the week’s 3,000–5,000 leads and check that the ready-copy runway is healthy.
   Daily, about 10 minutes: open the Issues feed, answer every interested reply personally and quickly, and resume
   anything the guard paused once you understand why.
   Weekly: review segment performance and gate failures, tighten the ICP and the prompts, and retire any domain with a
   weak reputation.
   Monthly: replace burned domains, rotate keys and write what you learned back into CLAUDE.md so Claude Code
   improves with you.



Troubleshooting

 Symptom                  Likely cause                               Fix

 Emails land in spam      Missing DKIM or DMARC, warm-up too         Check Show original, slow the ramp, keep plain text with
                          fast, weak targeting, links in the body    no links, tighten the ICP

  unauthorized_client     Wrong Client ID or scopes in domain-       Recheck the Admin console entry and the scopes, confirm
 or invalid_grant         wide delegation, or the user cannot use    the user has a Gmail-enabled licence, and allow time for
 from Gmail               Gmail                                      changes to propagate

 Deploy fails with a      You are on the Hobby plan                  Upgrade to Pro
 daily cron limit
 message

 Many quality-gate        Site text is empty because pages render    Fetch more pages or a rendered version, and tighten the
 failures                 with JavaScript, or the model              prompt to copy the sentence exactly
                          paraphrased the quote

 Duplicate sends          Missing claim lock or unique constraint    Use FOR UPDATE SKIP LOCKED , set sending in the claim
                                                                     transaction and keep unique (lead_id, step_no)

 Replies not detected     Expired history id or a thread mismatch    Reset history_id for that mailbox and fall back to a thread
                                                                     scan for recent sends

 Sends stall              Ready queue is empty or the local          Check the runway and the lead time zones
                          window is closed

 Gmail quota errors       Caps set too high for the ramp stage       Let the guard pause the mailbox and lower the caps




One-paste kickoff prompt for Claude Code

Once CLAUDE.md is in place and this guide is saved as docs/guide.md in your repo, start with:


  Read CLAUDE.md and docs/guide.md. We are building the outreach engine described there. Work in
  this order and stop after each step so I can review: 1) Gmail auth and test send, 2) database
  schema and migrations, 3) lead intake and ICP qualification, 4) research engine with the
  quality gate, 5) sender with caps and windows, 6) reply poller and classifier, 7) deliverability
  guard, 8) cron routes and vercel.json, 9) dashboard. For each step, propose a plan first, write
  tests for the rules in CLAUDE.md, run them, and commit. Never use real prospect data until I
  say so.


Start small, read every draft yourself in the pilot, and scale only when bounces stay low and replies come from the right
people. Targeting quality and honest copy matter more than any piece of infrastructure in this guide.

```
