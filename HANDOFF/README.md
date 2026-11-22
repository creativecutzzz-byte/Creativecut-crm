# Creative Cut Lead Agent — Handoff (सब कुछ एक जगह)

> इस फ़ाइल में कोई password / key / token नहीं है। Secrets सिर्फ़ Google Secret Manager और Vercel env vars में हैं (नाम नीचे दिए हैं)।

## 1. यह क्या है (एक लाइन में)
Apify + free job boards से उन लोगों को ढूँढता है जो **video editor / motion designer / podcast editor / agency** ढूँढ रहे हैं → qualify करता है → Creative Cut के YouTube sample के साथ personalised email draft बनाता है → Google Sheet में डालता है → आप approve करो → Gmail से भेजता है → reply/bounce/opt-out track करता है।

## 2. Mind Map

```
Creative Cut Lead Agent
├── Account (सब एक ही Gmail पर)
│   └── Creative Cut Gmail (owner of Google, Vercel, Apify, GitHub)
├── Code — GitHub
│   ├── Repo: creativecutzzz-byte/creativecut-crm
│   ├── Branch: claude/zen-thompson-dma7ne
│   ├── lead-engine/   → Python worker (leads ढूँढना, emails भेजना)
│   └── src/app/(agent)/agent → Next.js 16.4.5 app (manage करने वाला UI)
├── App (UI) — Vercel
│   ├── URL: https://creative-cut-lead-agent.vercel.app/agent
│   ├── Project: creative-cut-lead-agent (prj_aAc0zgZxIj4woGN0AdStZ3Zsq0Ce)
│   ├── Team: team_B4dj4R2eNMmjyG93Etyv2UjY (Vercel login से protected)
│   └── अभी: read-only snapshot (21 असली leads) — 3 env vars बाकी
├── Worker — Google Cloud (project: creative-cut-leads, region asia-south1)
│   ├── Cloud Run Job  → lead-engine (Dockerfile)
│   ├── Cloud Scheduler → 09:00 और 16:00 Asia/Kolkata
│   ├── Secret Manager → APIFY_TOKEN, GMAIL_SENDER_1..3_REFRESH_TOKEN, ...
│   ├── GCS bucket     → send ledger (duplicate email कभी नहीं)
│   └── Service accounts
│       ├── cc-lead-engine@creative-cut-leads.iam.gserviceaccount.com (worker)
│       ├── cc-lead-scheduler@... (scheduler trigger)
│       └── cc-lead-app@...      (Vercel app → Sheets/Run/Scheduler)
├── Data — Google Sheet (source of truth)
│   ├── "Creative Cut | Lead Generation & Outreach"
│   ├── ID: 1wxg9TbrErNUy42lWDDZPE5T82b_GnLUs8Am7zrU3Avs
│   └── Tabs: Dashboard, Leads, Outreach Queue, Suppression, Run Log, Settings
├── Playbook — Google Doc 15P2uFT-Q7LJ56D0t7Dwk8a_dx4YqF3niJDYxp71cvhY
├── Lead sources
│   ├── Apify: harvestapi/linkedin-post-search, curious_coder/linkedin-jobs-scraper,
│   │          apify/google-search-scraper, trudax/reddit-scraper-lite
│   ├── Free: RemoteOK, Arbeitnow
│   └── Email finders: Apollo, Vibe Prospecting, BetterContact (key बाकी)
├── Email — Gmail API (scopes: gmail.send + gmail.metadata)
│   ├── 3 sender slots, cap 10/day, warm-up
│   └── DRY_RUN / live sending OFF (आप चालू करोगे)
└── Status page (पुराना) — Netlify: https://creativecut-leads-internal.netlify.app
```

## 3. अब तक क्या हुआ (short summary)
1. Python worker बनाया (`lead-engine/`) — 27 tests पास। Apify Actors test किए, run IDs Run Log में।
2. Google Sheet बनाई — dropdowns, filters, dedupe, manual edits safe।
3. Playbook से personalised emails, verified YouTube sample, HTML links (Creative Cut, IG Creative)।
4. Gmail self-test अपने address पर भेजा — links चले।
5. Lead quality refine: 52 leads → 21 quality leads (8 के email draft तैयार)। Apify खर्च ~$0.57।
6. UI app बनाया: Home, Leads, Schedule, Settings → Connections; light theme, Creative Cut green, आपका logo।
7. Next.js 16.4.5 पर upgrade, Vercel पर deploy (SSO protected)।
8. OpenOutreach के useful हिस्से, graphify code graph (`graphify-out/`), free public APIs (RemoteOK, Arbeitnow, Kickbox, logoapi) जोड़े।

## 4. क्या बाकी है (गड़बड़ी/कमी)
| # | कमी | कौन |
|---|---|---|
| 1 | Vercel env vars: `AGENT_SERVICE_ACCOUNT_KEY`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET` | आप |
| 2 | Cloud Run worker एक बार भी cloud पर नहीं चला (`lead-engine/deploy/deploy.sh`) | आप/AI |
| 3 | Gmail sender connect (app → Connect with Google) | आप |
| 4 | BetterContact key | optional |
| 5 | Sheet में पुराने 30 leads, नए 21 सिर्फ़ snapshot में | पहला live run |
| 6 | Reply tracking असली inbox पर test | AI |
| 7 | Apify $5 free plan से ज़्यादा (~$6/माह) — Reddit बंद या upgrade | आप |
| 8 | Follow-up emails नहीं बने | AI |
| 9 | `SENDER_POSTAL_ADDRESS` खाली (CAN-SPAM) | आप |
| 10 | Live sending OFF (जानबूझकर) | आप, आखिर में |

## 5. Vercel env vars (सिर्फ़ नाम)
Set हैं: `AGENT_SHEET_ID`, `AGENT_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_CLOUD_PROJECT`, `GCP_REGION`, `CLOUD_RUN_JOB`, `SCHEDULER_SERVICE_ACCOUNT`, `AGENT_STATE_SECRET`
बाकी: `AGENT_SERVICE_ACCOUNT_KEY`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`
Optional: `AGENT_TRUSTED_ACCESS=true` (Vercel SSO के पीछे बिना app-login के बदलाव)

## 6. Setup steps (Google Cloud)
देखो `HANDOFF/GOOGLE_CLOUD_STEPS.md`।

## 7. ज़रूरी files
- `lead-engine/README.md` — worker पूरा manual
- `lead-engine/lead_engine/config.py` — सारी Settings keys
- `lead-engine/deploy/deploy.sh` — Google Cloud setup
- `src/lib/agent/` — app का data/Google logic
- `.claude/skills/creative-cut-lead-engine/SKILL.md` — safe चलाने के नियम
- `src/lib/agent/snapshot-data.json` — 21 leads का snapshot (zip में है, git में नहीं)
- `docs/agent-previews/` — UI screenshots
