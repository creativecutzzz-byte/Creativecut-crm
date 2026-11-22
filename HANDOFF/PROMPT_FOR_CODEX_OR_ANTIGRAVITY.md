# इसे Codex / Antigravity में पहले message के रूप में paste करो

You are taking over the "Creative Cut Lead Agent" project. First read, in this order:
HANDOFF/README.md, HANDOFF/GOOGLE_CLOUD_STEPS.md, lead-engine/README.md,
.claude/skills/creative-cut-lead-engine/SKILL.md, lead-engine/lead_engine/config.py,
src/lib/agent/types.ts and src/lib/agent/store.ts. Treat HANDOFF/README.md as project memory.

What it is: a lead-generation + personalised email outreach system for Creative Cut (video
editing agency, https://creativecut.in). A Python worker (lead-engine/, Cloud Run Job on Google
Cloud project "creative-cut-leads", triggered by Cloud Scheduler 09:00 and 16:00 Asia/Kolkata)
finds people actively hiring a video editor / motion designer / podcast editor / agency
(Apify Actors + RemoteOK + Arbeitnow), qualifies them, drafts emails from the Outreach Playbook
with one verified creativecut.in YouTube sample, writes everything to the Google Sheet
1wxg9TbrErNUy42lWDDZPE5T82b_GnLUs8Am7zrU3Avs, and sends via Gmail API (gmail.send + gmail.metadata)
after approval, with a durable GCS ledger so nothing is sent twice. A Next.js 16.4.5 app
(src/app/(agent)/agent) deployed on Vercel project "creative-cut-lead-agent"
(https://creative-cut-lead-agent.vercel.app/agent) is the control panel: Home, Leads, Schedule,
Settings → Connections.

Hard rules:
- Never put secrets in code, chat or git. Secrets live in Google Secret Manager and Vercel env vars.
- Never send real email unless I explicitly say so. Keep DRY_RUN / live sending off by default.
  Cap 10 emails/day per sender. Respect the Suppression tab and opt-outs.
- Never invent Apify Actor IDs or dataset fields; test before use.
- The Google Sheet is the source of truth; preserve my manual edits.
- Run `cd lead-engine && python -m pytest -q` (27 tests) and `npm run build` before any deploy.

Current state and open gaps are in section 4 of HANDOFF/README.md. Start by:
1. Verifying the app builds locally (`npm install && npm run build`) and tests pass.
2. Helping me finish the 3 missing Vercel env vars and the first Cloud Run run.
3. Then: Gmail connect, reply-tracking test, follow-up emails, postal address, Apify cost choice.
Answer me in simple Hinglish.
