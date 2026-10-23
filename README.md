# Creative Cut CRM

> **Start here:** [`playbook/00-start-here.md`](playbook/00-start-here.md) is the go-to-market plan this CRM runs: niche, offer and pricing, prospects, outreach sequences, sales script, proposal, landing page, content and ads, onboarding, retention and KPIs.

A premium, dark-themed AI CRM for the Creative Cut agency, built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4** and **Supabase**.

> **Safe by design:** WhatsApp and Instagram integrations are dry-run placeholders (nothing is ever sent), and Meta Ads is read-only analytics (nothing can be created or launched). No credentials are hardcoded.

## Features

| Area | Route | What's there |
| --- | --- | --- |
| CRM dashboard | `/dashboard` | KPIs, revenue vs pipeline trend, AI insights, pipeline by stage, lead sources, follow-ups, activity feed |
| Lead management | `/leads`, `/leads/[id]` | Table + kanban views, quick filters, create / edit / delete, owner & follow-up date, stage changes, activity log (calls, meetings, notes), lead tasks, convert to client, AI score with explainable factors |
| Client management | `/clients`, `/clients/[id]` | Create / edit / delete, retainers, MRR, account health, services, owners, activity log and tasks |
| Tasks | `/tasks` | My / everyone's tasks, overdue & upcoming, create (linked to a lead or client), complete, delete. Sequence steps show the ready-to-send message with a copy button. |
| Sales automation | lead page, `/settings` | Outreach sequences (cold, inbound, proposal, no-show, re-engage) as dated tasks with messages filled in; proposal follow-ups start automatically; onboarding checklist on conversion; monthly report tasks; CSV import; website lead capture (`/api/lead-capture`); conversion funnel on the dashboard |
| Search | `/search` | Leads and clients by name, company, email, phone or Instagram handle |
| WhatsApp Business | `/whatsapp` | Template composer with **simulated** send, connection checklist, create / delete templates |
| Instagram | `/instagram` | DM reply composer (**simulated**), Instagram-sourced leads, quick replies |
| Meta Ads analytics | `/ads` | Spend, ROAS, CPL, CTR, daily chart, per-campaign table (read-only) |
| Follow-up workflows | `/workflows` | Trigger → step sequences, activate/pause, dry-run test run against a real lead |
| Team management | `/team` | Members, roles, workload, invitations, change role / remove member, permission matrix |
| Settings | `/settings` | Rename workspace, your name, safety status, integration credential status |
| Accounts | `/signup`, `/login` | Sign up, password or magic-link sign-in, create a workspace in-app, invitations accepted automatically |

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — leave empty for demo mode
npm run dev                  # http://localhost:3000
```

**Demo mode:** with no Supabase env vars set, the app runs entirely on sample data (`src/lib/data/demo.ts`) and write actions return a friendly "demo mode" message.

### Connecting Supabase

1. Create a Supabase project and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API) in `.env.local` — or in your host's environment variables. Set `NEXT_PUBLIC_CURRENCY=INR` for rupees.
2. Apply the schema: `supabase link --project-ref <ref> && supabase db push` (or paste each file in `supabase/migrations/`, in order, into the SQL editor).
3. In Auth → URL Configuration, set the **Site URL** to your domain (e.g. `https://crm.creativecut.in`) and add `https://crm.creativecut.in/auth/callback` to the redirect URLs. Keep **email confirmation enabled** (invitations are matched by email).
4. Open `/signup`, create your account, then name your workspace — it's created with starter templates and workflows.
5. Invite teammates from `/team`; they join automatically when they sign up (or sign in) with the invited email.
6. Optional: `supabase gen types typescript --linked > src/lib/database.types.ts` for fully typed queries.

### Local development with a real database

With Docker running: `npx supabase start`, then copy the printed API URL and anon key into `.env.local`. Migrations in `supabase/migrations/` are applied automatically.

### Landing page and ads

- `landing/index.html`: the SaaS landing page, a single static file. Set `CRM_ENDPOINT` and `WORKSPACE_KEY` at the bottom (the values are on the CRM's Settings page) and host it anywhere.
- `landing/ads/`: rendered ad creatives (1080×1080 and 1080×1920) and their HTML source (`creatives.html`).

### Deploying

Any Next.js host works (Vercel is the simplest): import the repo, add the environment variables from step 1, deploy, then point `crm.creativecut.in` at it with a CNAME record and update the Supabase Site URL.

## Database schema

`supabase/migrations/20261020000000_init.sql` — multi-tenant by `org_id`, with Row Level Security on every table.

- **Tenancy & team:** `organizations`, `profiles`, `team_members` (roles: owner / admin / manager / member; invitations)
- **CRM:** `leads` (stage, source, value, AI score/summary/next action, consent), `clients` (retainer, services, health), `activities`, `tasks`
- **Messaging:** `message_templates`, `messages` (status includes `simulated`)
- **Automation:** `workflows`, `workflow_steps`, `workflow_runs` (`dry_run` defaults to true)
- **Integrations:** `integrations` — non-secret config plus a `secret_ref` to Supabase Vault; **never tokens**
- **Ads analytics:** `ad_campaigns`, `ad_insights_daily` (read-only mirror)

Policies: members read/write their org's data; managers+ edit workflows; owners/admins manage the team and integrations.

## Project structure

```
src/
  app/
    (auth)/login          sign-in (password or magic link)
    (app)/…               dashboard, leads, clients, whatsapp, instagram, ads, workflows, team, settings
    actions/              server actions (zod-validated)
    auth/callback         Supabase auth code exchange
  components/             ui primitives, layout, charts, feature components
  lib/
    data/                 data access layer (Supabase or demo data)
    integrations/         WhatsApp / Instagram / Meta Ads placeholders — see README there
    ai/                   rule-based lead scoring + insights (LLM-ready seam)
    workflows/engine.ts   pure workflow planner used for dry-run test runs
    supabase/             browser / server / proxy clients
  proxy.ts                session refresh + auth gate (Next 16 "proxy", formerly middleware)
supabase/migrations/      SQL schema
```

## AI

Lead scoring (`src/lib/ai/lead-scoring.ts`) and dashboard insights (`src/lib/ai/insights.ts`) are transparent and rule-based today, with the score factors shown on each lead. Both return the shape an LLM-backed implementation would, so a model can be dropped in later via a server-only API key.

## Credentials policy

- Only `NEXT_PUBLIC_SUPABASE_*` (public, RLS-protected) ever reach the browser.
- Integration tokens belong in server env vars or Supabase Vault; the UI only shows whether they're *present*.
- `.env*.local` is git-ignored. Dry-run is a code constant (`src/lib/integrations/safety.ts`), not a toggle.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
