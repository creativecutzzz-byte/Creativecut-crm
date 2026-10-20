# Creative Cut CRM

A premium, dark-themed AI CRM for the Creative Cut agency, built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4** and **Supabase**.

> **Safe by design:** WhatsApp and Instagram integrations are dry-run placeholders (nothing is ever sent), and Meta Ads is read-only analytics (nothing can be created or launched). No credentials are hardcoded.

## Features

| Area | Route | What's there |
| --- | --- | --- |
| CRM dashboard | `/dashboard` | KPIs, revenue vs pipeline trend, AI insights, pipeline by stage, lead sources, follow-ups, activity feed |
| Lead management | `/leads`, `/leads/[id]` | Table + kanban views, quick filters (hot / overdue / unassigned), search, create lead, stage changes, AI score with explainable factors |
| Client management | `/clients` | Retainers, MRR, account health, services, owners |
| WhatsApp Business | `/whatsapp` | Template composer with **simulated** send, connection checklist, templates |
| Instagram | `/instagram` | DM reply composer (**simulated**), Instagram-sourced leads, quick replies |
| Meta Ads analytics | `/ads` | Spend, ROAS, CPL, CTR, daily chart, per-campaign table (read-only) |
| Follow-up workflows | `/workflows` | Trigger → step sequences, activate/pause, dry-run test run against a real lead |
| Team management | `/team` | Members, roles, workload, invitations, permission matrix |
| Settings | `/settings` | Workspace, safety status, integration credential status |

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — leave empty for demo mode
npm run dev                  # http://localhost:3000
```

**Demo mode:** with no Supabase env vars set, the app runs entirely on sample data (`src/lib/data/demo.ts`) and write actions return a friendly "demo mode" message.

### Connecting Supabase

1. Create a Supabase project and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
2. Apply the schema: `supabase link --project-ref <ref> && supabase db push` (or paste `supabase/migrations/*.sql` into the SQL editor).
3. Keep **email confirmation enabled** in Auth settings (invitations are matched by email).
4. Sign up, then create the workspace as that user: `select create_organization('Creative Cut', 'creative-cut');`
5. Invite teammates from `/team`; they join automatically when they sign up with the invited email.
6. Optional: `supabase gen types typescript --linked > src/lib/database.types.ts` for fully typed queries.

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
