# Creative Cut CRM + Outreach Engine

This repo is the Creative Cut CRM (Next.js 16 App Router, TypeScript, Tailwind v4,
Supabase). The **Outreach Engine** (built from `docs/guide.md`) lives inside it as a
separate module with its own Postgres schema (`outreach`). See `README.md` for the CRM
and `docs/outreach-engine/README.md` for the engine.

## Outreach Engine goal
Weekly pipeline: import leads -> verify -> ICP qualify -> research -> draft ->
quality gate -> send -> follow up -> classify replies.

## Stack
Next.js App Router (TypeScript), Postgres (Supabase, schema `outreach`, accessed with `pg`
through DATABASE_URL), Anthropic SDK, googleapis. Deployed on Vercel (Pro: every-minute cron).

## Hard rules
- Emails are plain text. No tracking pixels and no wrapped links.
- Every company-specific claim needs an evidence quote that appears verbatim on the prospect page.
- One email at a time per mailbox, random 45-180 second gap (stored in next_send_at, never slept).
- Weekdays only, inside the recipient local morning window (Mon-Fri 08:00-11:00).
- Never send to an address on the suppression list. Check it again right before sending.
- A human reply stops that lead sequence immediately.
- Secrets come from environment variables only. Never log or commit them.
- Every cron route must verify the CRON_SECRET bearer token.
- Nothing leaves the system unless MESSAGING_MODE=live (otherwise sends are recorded as dry-run).
- Write tests for: quality gate, send window, suppression, stop-on-reply.
- Never use real prospect data in tests or development.

## Layout (engine)
src/app/(app)/engine/          dashboard page (owner/admin, ALLOWED_LOGIN_DOMAIN)
src/app/api/cron/              scheduler routes: research, send, replies, guard (+ agents for the CRM)
src/app/api/leads/upload       CSV intake
src/app/api/engine/unsubscribe one-click unsubscribe for engine emails
src/lib/engine/db/             pool, migrations runner, queries, analytics
src/lib/engine/gmail/          auth, raw message, send, poll
src/lib/engine/intake/         csv, normalise, verify, ICP qualify
src/lib/engine/research/       fetch, model chain, draft, gate
src/lib/engine/sender/         window, caps, send tick
src/lib/engine/replies/        detect, classify, apply actions
src/lib/engine/guard/          deliverability rules
config/icp.yaml, config/guard.yaml   editable config (no thresholds in code)
docs/schema.sql                engine schema (npm run migrate)
docs/prompts/                  model prompts

## Commands
npm run test · npm run typecheck · npm run lint · npm run migrate · npm run build
