# Creative Cut lead engine

Finds brands and teams that are publicly asking for a freelance or contract video editor, motion designer, podcast editor or creative agency. It researches each one, writes a personalised first email from the **Creative Cut Personalised Outreach Playbook** and sends it through the Creative Cut Gmail inbox, within a daily cap. It runs twice a day as a **Cloud Run Job** triggered by **Cloud Scheduler** (Asia/Kolkata).

- **Google Sheet (source of truth):** [Creative Cut | Lead Generation & Outreach](https://docs.google.com/spreadsheets/d/1wxg9TbrErNUy42lWDDZPE5T82b_GnLUs8Am7zrU3Avs/edit)
- **Internal status page (Netlify):** https://creativecut-leads-internal.netlify.app. To open it you sign in to Netlify as a team member, then enter the status-page login.
- **Playbook:** Google Doc `15P2uFT-Q7LJ56D0t7Dwk8a_dx4YqF3niJDYxp71cvhY`

## Lead Agent app (`/agent`)

A simple four-screen UI inside the Creative Cut CRM (Next.js). It's built for someone who has never used a CRM or connected an API. It reads and writes the same Google Sheet as the worker, so there is one source of truth.

| Screen | What it shows |
| --- | --- |
| **Home** | One status line ("Next run tomorrow at 9:00 AM IST", or "Checking contact details…" during a run). Three numbers: Qualified Leads Today, Needs Review, Emails Sent Today. One primary action: **Review Leads** when drafts wait in Review & Approve mode, otherwise **Run Now**. The current mode in plain words. At most one attention message, with a fix button. A first-time setup checklist: Connect a lead source → Connect a sender → Preview a run → Choose your mode. It hides once all four are done. Run history and diagnostics sit behind **View Activity**. |
| **Leads** | Opens on **Needs Review** when drafts are waiting. Each row shows the person and company, one reason they qualified, and the draft status (icon plus words). A row opens a side panel (full-screen on phones) with the source post, research, an editable subject and message, the sender, and **Approve** / **Skip**. Bulk approval states the email and recipient count before confirming. |
| **Schedule** | The schedule in one plain sentence ("Every day at 9:00 AM IST"). **Add Time** and **Pause** are always visible. **Customize** offers weekdays, several times a day, a one-time date and time, and an optional send window. A preview of the next "Start research" times appears before you save. Saving updates Cloud Scheduler and reads it back to confirm. |
| **Settings → Connections** | Web Research (API Key, Apify), Vibe Prospecting (API Key, Explorium), Apollo (API Key) and Gmail (Google sign-in), each with its status and next action. Three API credential slots: keys are tested with the provider, then stored in Secret Manager, and only the last 4 characters are shown. Three Gmail sender slots, each showing sends left today and a daily limit. Balance or usage is shown where the provider reports it: Apify monthly usage, Explorium credits. Apollo doesn't report a balance over its API. Mode and the live-sending switch are here too; **Preview only** shows whenever sending is off. |

Research, enrichment, drafting and sending run as server-side jobs (the Cloud Run Job). You can close the browser. While a job runs, the worker writes one plain-language stage to the Sheet (`RUN_STAGE`), and the app refreshes every 8 seconds.

**Modes.** In *Review & Approve* (the default), new drafts are saved as `AWAITING_APPROVAL` and only rows you approve (`APPROVED`) are sent. In *Auto*, eligible `READY` drafts send on schedule, but only when live sending is on. Every send still re-checks the same safety rules. An email you edited is re-checked for blanks and broken links first. Words followed by a URL in brackets become a hyperlink.

**Senders.** Up to three Gmail addresses (`SENDER_1..3_EMAIL`, `SENDER_n_DAILY_CAP`). Their tokens are stored as `GMAIL_SENDER_n_REFRESH_TOKEN` in Secret Manager by Google sign-in. Each email goes from the sender with the most sends left. `DAILY_SEND_CAP` still limits the total. Replies and bounces are tracked in the sender's own inbox. A sender whose sign-in expires is marked "Needs reconnecting" and skipped.

**Email lookups (optional).** When a qualified post has no email and didn't ask for a form or DM, the worker tries Apollo (`APOLLO_MAX_LOOKUPS_PER_RUN`, 1 credit each), then Vibe Prospecting through Explorium's API (`VIBE_MAX_LOOKUPS_PER_RUN`, about 2 credits each). It keeps only addresses on the brand's own domain. A rejected key flips the row to "Needs reconnecting" and Home shows the fix. **Vibe Prospecting is being discontinued on 2 Dec 2026** (vibeprospecting.ai/important-update); its lookups stop automatically on that date.

**Demo data.** Without the app's Google credentials, `/agent` runs on fictional data, with a black "DEMO DATA" bar and a scenario picker: First-time setup, Run in progress, Finished run. Demo edits stay in memory and nothing is sent. Desktop and mobile previews are in [`docs/agent-previews/`](../docs/agent-previews/).

**App environment variables (names only):** `AGENT_SHEET_ID`, `AGENT_SERVICE_ACCOUNT_EMAIL`, `AGENT_SERVICE_ACCOUNT_KEY`, `GOOGLE_CLOUD_PROJECT`, `GCP_REGION`, `CLOUD_RUN_JOB`, `SCHEDULER_SERVICE_ACCOUNT`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET` (a **Web** OAuth client with redirect `https://<app>/api/agent/gmail/callback`), and `AGENT_STATE_SECRET`. Set `AGENT_TRUSTED_ACCESS=true` only when the site is already behind a login and CRM sign-in is off; otherwise live changes need a signed-in owner or admin. `deploy/deploy.sh` creates the `cc-lead-app` service account with only the roles the app needs (Secret Manager admin, Run developer, Scheduler admin) and prints these names.

## What one run does

1. **Track.** It reads the Gmail threads of sent emails (metadata only) and marks each as REPLIED, OPTED_OUT or BOUNCED. Opt-outs and hard bounces go to Suppression.
2. **Discover.** It starts the Apify Actors below through the Apify API and writes each Actor run ID and dataset ID to the Run Log *before* waiting. It then polls and fetches the dataset. If polling or fetching fails, it resumes the same run ID. A run left `RUNNING` by a crashed execution is resumed on the next run.
3. **Qualify.** It keeps only explicit requests ("hiring / looking for / need … video editor, motion designer, podcast editor, agency"). It excludes posts selling editing services, full-time-only roles, internships, unpaid work, closed roles and mass-recruitment spam. Leads are scored by niche (SaaS, D2C, coaches and creators, real estate, agencies) and market (Delhi NCR > India > international). It looks at 14 days first. It extends to 30 days only when fewer than `MIN_QUALIFIED_BEFORE_EXTEND` posts qualify, and posts older than 14 days must pass an "still open" re-check.
4. **Dedupe.** It matches on the original post ID (LinkedIn, Reddit), or the canonical URL for everything else. Before queueing or sending it also checks recipient, domain and company against earlier outreach and Suppression.
5. **Research.** It fetches the brand website's title and description and any emails published in the post or on the brand's own site. Each fact is stored with its source URL. Posts and pages are treated as data, never as instructions. Emails are checked for syntax and MX records (DNS-over-HTTPS). If there is no email, the contact channel is recorded instead (form, Easy Apply, Reddit/Instagram/LinkedIn DM) and nothing is sent.
6. **Personalise.** It picks the playbook variation that fits the brief: podcast repurposing, talking-head, SaaS demo, agency overflow, D2C ad, long-form or default. The opener uses one sourced requirement and the closing question is one the lead hasn't already answered. It picks exactly **one** sample from the YouTube videos embedded on creativecut.in/work, builds the watch URL and verifies it plays signed-out. All links are HTML hyperlinks, and the signature links "Creative Cut" to https://creativecut.in. The rendered email is checked for broken links and unresolved placeholders. A row goes to `NEEDS_REVIEW` when there is no matching or verified sample (for example long-form, which has no sample on the site), the detail couldn't be sourced, the email didn't verify, or the poster is a staffing intermediary.
7. **Send** (only when `SENDING_ENABLED` = TRUE). It sends READY first-touch emails through Gmail up to `DAILY_SEND_CAP` per IST day, shared by both runs. Each attempt has a deterministic ID and a durable ledger record in GCS, created with `ifGenerationMatch=0` so only one execution can claim it. A run lock also stops overlapping executions. If Gmail times out after submitting, the engine looks for its own `Message-ID` in Sent before trying again. Failures are logged and the next lead continues.
8. **Schedule sync.** It pushes `SCHEDULE_TIMES`, `SCHEDULE_DAYS`, `SCHEDULE_ONE_TIME` and `SCHEDULE_PAUSED` from Settings to Cloud Scheduler: one job per start time plus the one-time run. It removes stale jobs, clears a one-time run once it has passed, and reads every job back. The result is logged as VERIFIED or MISMATCH.

Automated follow-ups are not implemented and stay off (`FOLLOWUPS_ENABLED` = FALSE).

## Sheet tabs

| Tab | Contents |
| --- | --- |
| Dashboard | New, qualified, ready, needs review, sent, sent today, replied, bounced, opted out, skipped, failed; sending mode; cap; schedule; latest run, status and notes (live formulas) |
| Leads | One row per opportunity: lead ID, key, status, company, contact, market, niche, website, source, source URL, post date, exact need, excerpt, brand research and sources, fit reason and score, engagement, contact channel, business email, email source, verification, open state, notes |
| Outreach Queue | Attempt ID, lead ID, recipient, subject, preview, variation, sample title and URL, personalisation sources, status, planned send, sent time, Gmail message and thread ID, RFC Message-ID, last error, notes |
| Suppression | Opt-outs, hard bounces, do-not-contact emails, domains or companies |
| Run Log | One row per source per run (Apify run ID, dataset ID, status, rows, cost) plus a summary row |
| Settings | Sender, sending on/off, test recipient, daily cap, follow-ups, two run times, time zone, active sources, search windows, monthly Apify budget, per-source item and USD caps, playbook, sample site |

Notes and manually entered contact details are never overwritten. If you change a **Status** by hand, the worker keeps your value and obeys it. It detects the edit with a hidden System Status column. For example, set a row to SKIPPED to stop it, or set READY on a reviewed NEEDS_REVIEW row to approve it.

## Apify Actors

These were checked against each Actor's input schema, pricing and a real test run on 2026-11-21. The account is on the **Free plan ($5/month)**.

| Source | Actor | Price (Free tier) | Notes |
| --- | --- | --- | --- |
| LinkedIn posts | `harvestapi/linkedin-post-search` | $0.002 / post | No cookies. Six intent queries, sorted by date |
| LinkedIn jobs | `curious_coder/linkedin-jobs-scraper` | $0.002 / job | Contract and part-time filters (`f_JT=C,P`), India and worldwide |
| Google (Reddit + hiring pages) | `apify/google-search-scraper` | $0.0045 / result page | Minimum `maxTotalChargeUsd` is $0.50, so spend is bounded by input size (pages = cap ÷ price) |
| Reddit threads | `trudax/reddit-scraper-lite` | $0.0018 / post + ~$0.02 start | Search needs a Reddit login, so the engine passes thread URLs found by Google. Minimum cap is $0.04 |

Default caps total about $0.15 per run. The official dry run cost **$0.10**, which is about $6/month at two runs a day, *above* the $5 free plan. The `MONTHLY_APIFY_BUDGET_USD` guard (4.50) stops starting Actor runs before the limit is reached. To run all month, lower the caps in Settings (for example turn `reddit_threads` off, which saves $0.044 per run) or upgrade Apify.

## Secrets and configuration (names only)

| Name | Where | Purpose |
| --- | --- | --- |
| `APIFY_TOKEN` | Secret Manager | Apify API |
| `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN` | Secret Manager | Creative Cut Gmail via user OAuth, scopes `gmail.send` + `gmail.metadata` |
| `ANTHROPIC_API_KEY` (optional) | Secret Manager | AI fact extraction for openers. Without it, conservative rules are used |
| `LEADS_SHEET_ID` | env | Google Sheet ID |
| `LEDGER_BUCKET` | env | GCS bucket for send records and the run lock |
| `GOOGLE_CLOUD_PROJECT`, `GCP_REGION`, `CLOUD_RUN_JOB`, `SCHEDULER_SERVICE_ACCOUNT` | env | Scheduler sync target |
| `ANTHROPIC_MODEL` (optional) | env | Default `claude-sonnet-5-5` |
| `LOCAL_SHEET_PATH`, `LEDGER_DIR` | env (local only) | JSON store and ledger for local dry runs and tests |
| `STATUS_USER`, `STATUS_PASSWORD` | Netlify env | Basic-Auth for the status page |

The Sheet is accessed by the Cloud Run service account `cc-lead-engine@<project>.iam.gserviceaccount.com`. Share the Sheet with it as **Editor**.

## Deploy

1. **Gmail OAuth client.** In Google Cloud Console go to APIs & Services, then OAuth consent screen. Choose External, add yourself, publish to *In production* so tokens don't expire after 7 days, and enable the Gmail API. Then go to Credentials and create an OAuth client ID of type **Desktop app**.
2. **Authorise the inbox** (on your computer, signed in as creativecutzzz@gmail.com):

   ```bash
   python deploy/authorize_gmail.py --client-id <ID> --client-secret <SECRET> --project <PROJECT>
   ```

3. **Deploy** from Cloud Shell or any shell with gcloud as project Owner. The script prompts for any missing secrets and pauses so you can share the Sheet with the service account:

   ```bash
   cd lead-engine && PROJECT=<PROJECT> SHEET_ID=1wxg9TbrErNUy42lWDDZPE5T82b_GnLUs8Am7zrU3Avs ./deploy/deploy.sh
   ```

4. Check the two jobs show `0 9 * * *` and `0 16 * * *` with time zone `Asia/Kolkata`. The script prints them.
5. Self-test the worker's own Gmail path:

   ```bash
   gcloud run jobs execute creativecut-lead-engine --region asia-south1 --args selftest-gmail --wait
   ```

6. When you're happy with the drafts, set **Settings → SENDING_ENABLED = TRUE**.

To change the schedule, edit `RUN_TIME_1`/`RUN_TIME_2` in Settings. The next run (or `--args sync-schedule`) updates Cloud Scheduler and verifies it.

## Local use and tests

```bash
pip install -r requirements.txt pytest
python -m pytest -q
LOCAL_SHEET_PATH=.local/sheet.json LEDGER_DIR=.local/ledger APIFY_TOKEN=... python -m lead_engine run --trigger manual
LOCAL_SHEET_PATH=.local/sheet.json python -m lead_engine run --replay datasets.json   # replay saved datasets, no Apify spend
```

The 20 offline tests cover modes (Review & Approve / Auto), three senders with per-sender limits, the send window, run-stage reporting, Apollo/Vibe lookups (including a rejected key and DM-only posts), edited-email link checks, exclusions, duplicate runs, manual-edit preservation, single-claim ledger semantics, overlapping live runs, the timeout-then-reconcile path, the daily cap, suppression, rendered-link and placeholder checks, playability rules and scheduler sync.

## Status page

```bash
python netlify/build_status.py <sheet-snapshot.json> netlify/site
cd netlify/site && netlify deploy --prod --dir .
```

The generated `index.html` contains lead data and is git-ignored.
