# Outreach Engine

The automated outreach engine from [`docs/guide.md`](../guide.md) (original PDF in this folder), built into the Creative Cut CRM.
Every week it verifies and ICP-qualifies uploaded leads, reads each prospect's website, drafts a short plain-text email,
**proves** every company-specific claim against a verbatim quote from their site, sends one email at a time per mailbox in the
prospect's local weekday morning, follows up in the same thread, stops the moment a human replies, and shows everything at
**`/engine`** (owners and admins only).

> **Safe by default.** Nothing is emailed until `MESSAGING_MODE=live`. Build and pilot against your own test addresses first.
> This is not legal advice — clear each target region (CAN-SPAM, GDPR/PECR, CASL, India's rules) and list only those in
> `config/icp.yaml → allowed_countries`.

## How it maps onto the guide

| Guide step | Where it lives |
| --- | --- |
| 1. Project + CLAUDE.md | `CLAUDE.md` (hard rules), `docs/guide.md` |
| 2. Domains + mailbox fleet | You: registrar, DNS, Workspace. Then **/engine → Add a sending domain**. Warm-up ramp is code (`sender/caps.ts`): 10/20/30/40 per mailbox per day by week, 120/domain. |
| 3. Service account | `src/lib/engine/gmail/auth.ts` (`gmailFor(mailbox)`), `npm run test-send -- <from> <to>` |
| 4. Database | `docs/schema.sql` (schema `outreach`), `npm run migrate`, `src/lib/engine/db/` (SKIP LOCKED claims) |
| 5. Intake, verification, ICP | `config/icp.yaml`, `POST /api/leads/upload` (or the upload card), `intake/verify.ts`, `intake/qualify.ts`, `docs/prompts/qualify.md` |
| 6. Research + quality gate | `research/fetch.ts` (robots.txt, 10s timeout, cache), `research/research.ts`, `research/gate.ts`, `docs/prompts/draft.md`, `docs/prompts/faithfulness.md`, model chain in `research/models.ts` |
| 7. Sending engine | `sender/send.ts`, `gmail/message.ts`, `/api/engine/unsubscribe` |
| 8. Replies + follow-ups | `replies/poll.ts`, `replies/detect.ts`, `docs/prompts/classify.md`, `docs/reply-actions.md` |
| 9. Deliverability guard | `guard/rules.ts`, `guard/run.ts`, `config/guard.yaml`, `docs/guard-rules.md` |
| 10. Scheduler + deploy | `vercel.json`, `src/app/api/cron/{research,send,replies,guard}`, `/api/health` |
| 11. Dashboard | `src/app/(app)/engine/page.tsx`, `src/lib/engine/db/analytics.ts` |

## Setup

1. **Database.** Use the CRM's Supabase project (or any Postgres). Copy the connection string (transaction pooler, port 6543) into
   `DATABASE_URL` locally and in Vercel, then run once:
   ```bash
   npm run migrate
   ```
2. **Claude API.** `ANTHROPIC_API_KEY`. `MODEL_CHAIN` / `SMALL_MODEL_CHAIN` set the fallback order.
3. **Domains and DNS (Step 2 of the guide).** ~10 lookalike domains that redirect to your site; each added to Workspace as a secondary
   domain with MX, SPF (`v=spf1 include:_spf.google.com ~all`), DKIM (2048-bit, Admin console → Gmail → Authenticate email) and DMARC
   (`v=DMARC1; p=none; rua=mailto:dmarc@yourmaindomain`). Check "Show original" says PASS for all three. Add each domain to Postmaster Tools.
4. **Mailboxes.** 3 real people per domain with photo and plain-text signature. Add them at **/engine → Add a sending domain**
   (`Name <email>` per line). They start in warm-up.
5. **Service account (Step 3).** Google Cloud project → enable Gmail API → service account → JSON key. Admin console → Security →
   API controls → Domain-wide delegation → add the Client ID with exactly these scopes:
   `https://www.googleapis.com/auth/gmail.send,https://www.googleapis.com/auth/gmail.readonly`.
   Then `GOOGLE_SA_KEY_B64=$(base64 -w0 key.json)` and test one mailbox:
   ```bash
   npm run test-send -- aanya@trybrand.com you@yourpersonal.test
   ```
6. **Verification.** `VERIFY_PROVIDER` (zerobounce or neverbounce) + `VERIFY_API_KEY`. Without it, leads stay "uploaded".
7. **Secrets and URLs.** `CRON_SECRET` (32+ random chars), `UNSUB_SECRET`, `UNSUB_BASE_URL` (a domain you control, e.g. `https://crm.creativecut.in`),
   `ALERT_WEBHOOK_URL`, `ALLOWED_LOGIN_DOMAIN`. Identity: `OUTREACH_COMPANY_NAME`, `OUTREACH_OFFER`, `OUTREACH_POSTAL_ADDRESS`.
8. **ICP.** Edit `config/icp.yaml` (industries, titles, size, allowed countries, `min_score`).
9. **Deploy (Vercel Pro).** The every-minute crons in `vercel.json` need the **Pro** plan; on Hobby the deploy fails with a daily-cron
   limit error. Push, add every variable for Production, redeploy, confirm the jobs under Settings → Cron Jobs, then trigger each once:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://crm.creativecut.in/api/cron/guard
   ```
   and check the Live activity feed. Test the unsubscribe link from a real inbox.
10. **Dashboard login.** Set `ALLOWED_LOGIN_DOMAIN`. Optional Google button: enable Google in Supabase → Authentication → Providers
    and set `SUPABASE_GOOGLE_LOGIN=true`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (schema `outreach`) |
| `ANTHROPIC_API_KEY` | Runtime Claude calls |
| `MODEL_CHAIN`, `SMALL_MODEL_CHAIN` | Comma-separated model IDs in fallback order |
| `GOOGLE_SA_KEY_B64` | Base64-encoded service account key |
| `CRON_SECRET` | Bearer token Vercel sends to every cron route |
| `UNSUB_SECRET`, `UNSUB_BASE_URL` | Sign unsubscribe tokens; base URL for the link |
| `VERIFY_PROVIDER`, `VERIFY_API_KEY` | Email verification provider |
| `ALERT_WEBHOOK_URL` | Slack incoming webhook or similar |
| `ALLOWED_LOGIN_DOMAIN` | Workspace domain allowed to open the dashboard |
| `MESSAGING_MODE` | Must be `live` for anything to be sent |
| `OUTREACH_COMPANY_NAME`, `OUTREACH_OFFER`, `OUTREACH_POSTAL_ADDRESS` | Prompt identity and signature |
| `SEND_WINDOW_START`, `SEND_WINDOW_END`, `OUTREACH_DEFAULT_TIMEZONE` | Send window (default 8-11, Mon-Fri) |
| `ENGINE_ENABLED` | `false` stops every engine cron job |

## Tests

```bash
npm test                                   # unit tests (gate, window, caps, intake, replies, robots)
TEST_DATABASE_URL=postgres://… npm test    # + integration tests against a throwaway Postgres
```
The integration tests cover SKIP LOCKED claims, CSV dedupe/suppression, double-send protection, caps, the send window,
suppression re-check before sending, stop-on-reply (including a reply that lands just before a follow-up), threading,
auto-replies, opt-outs and the guard pausing a mailbox on simulated bounces. **Never point `TEST_DATABASE_URL` at production** —
the tests truncate the `outreach` tables.

## Go-live checklist

- [ ] Every domain passes SPF, DKIM and DMARC, and is verified in Postmaster Tools.
- [ ] A test email from each mailbox reaches the inbox at Gmail, Outlook and a Workspace address.
- [ ] The warm-up ramp is enforced by code and reads from the database (mailboxes show "wk N" on /engine).
- [ ] Suppression tested end to end: List-Unsubscribe link, one-click POST and a reply saying "stop".
- [ ] Stop-on-reply tested with a dummy lead, including a reply just before a follow-up.
- [ ] The quality gate rejects a fabricated quote (`npm test`).
- [ ] The guard pauses a mailbox on simulated bounces (`TEST_DATABASE_URL=… npm test`).
- [ ] `allowed_countries` matches the regions cleared with legal advice.
- [ ] /engine sits behind login + `ALLOWED_LOGIN_DOMAIN`; every secret lives only in Vercel env vars.
- [ ] Pilot: 50 real leads, read every draft yourself, then 200, then scale. Only then set `MESSAGING_MODE=live` for real volume.

## Weekly rhythm

- **Monday:** upload the week's leads; check the ready-copy runway is ≥ 2 days.
- **Daily (~10 min):** Live activity → Issues; answer every interested reply personally; resume anything the guard paused once you know why; enter Postmaster numbers.
- **Weekly:** segment performance and gate failures; tighten `config/icp.yaml` and `docs/prompts/*`; retire weak domains.
- **Monthly:** replace burned domains, rotate keys, write what you learned back into `CLAUDE.md`.

## Differences from the guide (and why)

- **Same repo, separate schema.** The engine lives in the CRM (shared login, Supabase project and deploy) but in its own `outreach`
  schema reached through `pg`, so `FOR UPDATE SKIP LOCKED` works and CRM leads never mix with engine leads.
- **Unsubscribe path** is `/api/engine/unsubscribe` because the CRM's own sequences already use `/api/unsubscribe`.
- **Sending needs `MESSAGING_MODE=live`**, the CRM's existing master switch, on top of everything in the guide.
- **Window check in the claim query.** Steps outside the recipient's window are never claimed (instead of claimed and put back), so
  out-of-window leads can't starve the queue. The JS check stays as a second guard.
- **Thread labels:** the scopes in the guide (`gmail.send`, `gmail.readonly`) can't label threads, so interested replies are
  surfaced through alerts and the dashboard instead.
- **Theme:** the dashboard follows the CRM's dark theme; the CRM has no light theme yet.
- **Meetings** are marked from the dashboard ("Meeting booked"); Calendar-based detection is not wired up.
