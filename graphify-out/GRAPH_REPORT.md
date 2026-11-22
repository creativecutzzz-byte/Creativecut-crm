# Graph Report - Creativecut-crm  (2026-11-22)

## Corpus Check
- 260 files · ~130,926 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 5, .woff2 3, .toml 2)

## Summary
- 1723 nodes · 5497 edges · 80 communities (69 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 102 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7679720a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils.ts
- lib/types.ts
- registry.ts
- sheet-store.ts
- gmail.ts
- __main__.py
- agent.ts
- pipeline.py
- outreach-writer.ts
- reply-handler.ts
- test_engine.py
- react
- Button
- http
- dashboard/page.tsx
- server-only
- Creative Cut lead engine
- data/index.ts
- compose.py
- cn
- zod
- Pipeline
- lib/actions.ts
- ui.tsx
- util.py
- requireWorkspace
- connections-view.tsx
- (app)/settings/page.tsx
- meta/route.ts
- LocalLedger
- next
- env.ts
- leads/leads-view.tsx
- sender.ts
- Opportunity
- schedule.ts
- actions/leads.ts
- AI Sales System: वीडियो वाले "50+ Agents" को Creative Cut CRM में बनाना
- package.json
- compilerOptions
- workflow-card.tsx
- dependencies
- shell.tsx
- authorize_gmail.py
- 3. Offer and pricing
- GcsLedger
- 1. Niche and ideal customer
- 9. Marketing content and ad creatives
- 11. Client onboarding and retention
- ads-chart.tsx
- appsscript.json
- 7. Proposal template
- 14. Automating repetitive work
- settings-forms.tsx
- 5. Outreach sequences and personalisation
- actions/sequences.ts
- _fake_scheduler
- 00-start-here.md
- Gmail + Google Calendar को मुफ़्त में जोड़ना (Apps Script, Google Cloud नहीं चाहिए)
- 2. Competition
- 4. Finding customers and generating leads
- 6. Sales call script and objection handling
- 10. Sales funnel and CRM automation
- 12. Case studies
- app/layout.tsx
- Creative Cut lead engine — how to run it safely
- test_bettercontact_lookup_polls_and_keeps_only_usable_brand_emails
- scripts
- 8. Landing page
- 13. KPIs, tracking and improving conversion
- आम Gmail (@gmail.com) को CRM से जोड़ना
- roadmap.ts
- eslint-config-next
- deploy.sh
- edge-functions/auth.ts
- vercel.json
- THIRD_PARTY_NOTICES.md
- engines
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `next` - 76 edges
2. `cn()` - 76 edges
3. `lucide-react` - 57 edges
4. `Button()` - 56 edges
5. `react` - 53 edges
6. `requireWorkspace()` - 49 edges
7. `server-only` - 47 edges
8. `Badge()` - 46 edges
9. `Card()` - 46 edges
10. `CardHeader()` - 46 edges

## Surprising Connections (you probably didn't know these)
- `Database schema` --references--> `simulated()`  [INFERRED]
  README.md → src/lib/integrations/safety.ts
- `make_store()` --uses--> `Env`  [INFERRED]
  lead-engine/lead_engine/__main__.py → lead-engine/lead_engine/config.py
- `make_ledger()` --uses--> `Env`  [INFERRED]
  lead-engine/lead_engine/__main__.py → lead-engine/lead_engine/config.py
- `make_gmail()` --uses--> `Env`  [INFERRED]
  lead-engine/lead_engine/__main__.py → lead-engine/lead_engine/config.py
- `make_gmail()` --uses--> `GmailError`  [INFERRED]
  lead-engine/lead_engine/__main__.py → lead-engine/lead_engine/gmail.py

## Import Cycles
- None detected.

## Communities (80 total, 11 thin omitted)

### Community 0 - "utils.ts"
Cohesion: 0.11
Nodes (44): ClientPage(), generateMetadata(), Row(), ClientsPage(), healthTone(), metadata, generateMetadata(), LeadPage() (+36 more)

### Community 1 - "lib/types.ts"
Cohesion: 0.06
Nodes (48): AppLayout(), NoOrganization(), MobileTabs(), TABS, ADMINS, BadgeKey, LEADERS, NAV_SECTIONS (+40 more)

### Community 2 - "registry.ts"
Cohesion: 0.07
Nodes (39): @supabase/supabase-js@^2.118.0, @supabase/supabase-js, apolloAgent, config, Config, MatchPerson, SearchPerson, assessment (+31 more)

### Community 3 - "sheet-store.ts"
Cohesion: 0.08
Nodes (46): apiRow(), buildConnections(), PROVIDERS, sendsLeft(), STATUS_TEXT, todayLimit(), VIBE_SHUTDOWN, body() (+38 more)

### Community 4 - "gmail.ts"
Cohesion: 0.08
Nodes (40): RFC-2822, dynamic, escapeHtml(), GET(), page(), GET(), appsScript(), hasAppsScript() (+32 more)

### Community 5 - "__main__.py"
Cohesion: 0.07
Nodes (17): build_mime(), _dropdown(), layout_requests(), rename_first_sheet(), _rng(), main(), make_gmail(), make_ledger() (+9 more)

### Community 6 - "agent.ts"
Cohesion: 0.14
Nodes (39): approveDrafts(), disconnectSender(), done(), fail(), guard(), removeApiKey(), run(), runNow() (+31 more)

### Community 7 - "pipeline.py"
Cohesion: 0.09
Nodes (18): Settings, apollo_lookup(), AuthError, _bc_headers(), bettercontact_credits(), bettercontact_lookup(), Found, _norm() (+10 more)

### Community 8 - "outreach-writer.ts"
Cohesion: 0.08
Nodes (38): schema, advanceLeads(), config, DEFAULT_WRITER_CONFIG, LeadRow, loadSender(), loadWhatsAppTemplate(), outreachWriterAgent (+30 more)

### Community 9 - "reply-handler.ts"
Cohesion: 0.08
Nodes (33): callListAgent, callPlan(), config, Config, LeadRow, plan, Plan, config (+25 more)

### Community 10 - "test_engine.py"
Cohesion: 0.11
Nodes (30): Env, Research, normalize(), FakeGmail, li_post(), make(), offline(), run() (+22 more)

### Community 11 - "react"
Cohesion: 0.13
Nodes (30): react, AuthState, createWorkspace(), credentials, safeNext(), sendMagicLink(), signIn(), signOut() (+22 more)

### Community 12 - "Button"
Cohesion: 0.17
Nodes (29): RFC-4180, deleteClientRecord(), convertLead(), NewTemplateButton(), TemplateForm(), ClientActions(), ClientForm(), Member (+21 more)

### Community 13 - "http"
Cohesion: 0.10
Nodes (9): Apify, go(), ApifyError, RunResult, Gmail, GmailError, GmailTimeout, http() (+1 more)

### Community 14 - "dashboard/page.tsx"
Cohesion: 0.15
Nodes (31): AdsPage(), metadata, DashboardPage(), greeting(), metadata, TeamPage(), ConnectionStep, AdsChart() (+23 more)

### Community 15 - "server-only"
Cohesion: 0.11
Nodes (25): server-only, schema, sendMessage(), SendState, Campaign, config, Config, Insight (+17 more)

### Community 16 - "Creative Cut lead engine"
Cohesion: 0.06
Nodes (32): 0. पहले से ज़रूरी चीज़ें, 1. Meta App तैयार करना, 2. WhatsApp, 3. Instagram, 4. टेस्ट और Live करना, WhatsApp और Instagram को CRM से जोड़ना (स्टेप-बाय-स्टेप), दिक्कत आए तो, Adopted from OpenOutreach (+24 more)

### Community 17 - "data/index.ts"
Cohesion: 0.15
Nodes (31): LeadsPage(), metadata, metadata, SCOPES, TasksPage(), HOT, metadata, TodayPage() (+23 more)

### Community 18 - "compose.py"
Cohesion: 0.10
Nodes (18): _a(), check_rendered(), choose_variation(), compose(), Email, Facts, links_in(), pick_question() (+10 more)

### Community 19 - "cn"
Cohesion: 0.13
Nodes (26): lucide-react, metadata, OutreachPage(), VIEWS, istDate(), metadata, SalesPage(), metadata (+18 more)

### Community 20 - "zod"
Cohesion: 0.13
Nodes (29): zod, bookSlot(), BookState, schema, DaySlots, BookPage(), dynamic, metadata (+21 more)

### Community 21 - "Pipeline"
Cohesion: 0.14
Nodes (6): Pipeline, SenderSlot, reddit_urls_from(), canonical_url(), iso(), now_utc()

### Community 22 - "lib/actions.ts"
Cohesion: 0.12
Nodes (26): saveCheckin(), schema, clientSchema, createClientRecord(), parseClient(), updateClientRecord(), createTask(), deleteTask() (+18 more)

### Community 23 - "ui.tsx"
Cohesion: 0.13
Nodes (27): ActivityPage(), metadata, RESULT, when(), LeadsPage(), metadata, AgentHome(), Checklist() (+19 more)

### Community 24 - "util.py"
Cohesion: 0.12
Nodes (16): attempt_id(), check_open(), extract_emails(), _fetch(), guess_website(), is_relevant_business_email(), _meta(), research() (+8 more)

### Community 25 - "requireWorkspace"
Cohesion: 0.17
Nodes (27): ADMIN, runAgentNow(), saveAgentConfig(), setAgentEnabled(), setMeetingOutcome(), approveAllEmails(), approveDraft(), APPROVERS (+19 more)

### Community 26 - "connections-view.tsx"
Cohesion: 0.19
Nodes (23): ActionResult, metadata, SettingsPage(), ApiKeyForm(), ConnectionsView(), ICON, Senders(), ModePicker() (+15 more)

### Community 27 - "(app)/settings/page.tsx"
Cohesion: 0.20
Nodes (21): InstagramPage(), metadata, metadata, Row(), SettingsPage(), metadata, WhatsAppPage(), ConnectionCard() (+13 more)

### Community 28 - "meta/route.ts"
Cohesion: 0.13
Nodes (20): RFC-8058, dynamic, GET(), maxDuration, dynamic, GET(), page(), POST() (+12 more)

### Community 29 - "LocalLedger"
Cohesion: 0.10
Nodes (5): Ledger, LocalLedger, RunStats, BaseStore, test_ledger_claim_is_exclusive()

### Community 30 - "next"
Cohesion: 0.11
Nodes (19): nextConfig, next, inviteSchema, InviteState, loadManageableMember(), memberSchema, removeMember(), updateMemberRole() (+11 more)

### Community 31 - "env.ts"
Cohesion: 0.14
Nodes (15): @supabase/ssr, CORS, schema, LoginPage(), metadata, metadata, SignUpPage(), LogoMark() (+7 more)

### Community 32 - "leads/leads-view.tsx"
Cohesion: 0.16
Nodes (18): matches(), metadata, SearchPage(), LeadsBoard(), LeadsTable(), LeadsView(), QuickFilter, StageBadge() (+10 more)

### Community 33 - "sender.ts"
Cohesion: 0.16
Nodes (21): outreachSenderAgent, defineAgent(), DAY, inSendWindow(), istDayStart(), unresolvedPlaceholders(), cancel(), DEFAULT_SENDER_SETTINGS (+13 more)

### Community 34 - "Opportunity"
Cohesion: 0.18
Nodes (13): detect_answered(), extract_facts(), facts_by_ai(), facts_by_rules(), _join(), _project(), _requirement_from_rules(), assess() (+5 more)

### Community 35 - "schedule.ts"
Cohesion: 0.29
Nodes (21): saveSchedule(), ScheduleView(), cronJobs(), DAY_NAMES, describeDays(), describeSchedule(), describeWindow(), DOW_INDEX (+13 more)

### Community 36 - "actions/leads.ts"
Cohesion: 0.14
Nodes (20): importLeads(), NOTE_COLUMNS, pick(), rowSchema, activitySchema, convertSchema, createLead(), deleteLead() (+12 more)

### Community 37 - "AI Sales System: वीडियो वाले "50+ Agents" को Creative Cut CRM में बनाना"
Cohesion: 0.09
Nodes (20): 0. AI Orchestrator (Main Brain), 1. Lead Generation, 2. Outreach, 3. Sales Calling, 4. CRM Operations, AI Sales System: वीडियो वाले "50+ Agents" को Creative Cut CRM में बनाना, Build plan (phases), Knowledge layer, Analytics, Human oversight, Security (+12 more)

### Community 38 - "package.json"
Cohesion: 0.14
Nodes (19): description, devDependencies, eslint@^9.39.5, tailwindcss@^4.3.3, @tailwindcss/postcss@^4.3.3, @types/node@^22.20.5, @types/react@^19.3.0, @types/react-dom@^19.3.0 (+11 more)

### Community 39 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 40 - "workflow-card.tsx"
Cohesion: 0.24
Nodes (14): TestRunState, testWorkflow(), ToggleState, toggleWorkflow(), stepIcons, triggerDetail(), triggerLabels, WorkflowCard() (+6 more)

### Community 41 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @anthropic-ai/sdk@^1.6.0, clsx@^2.1.1, lucide-react@^1.60.0, next@16.4.5, react@^19.3.1, react-dom@^19.3.1, recharts@^3.10.1 (+8 more)

### Community 42 - "shell.tsx"
Cohesion: 0.21
Nodes (12): chooseDemo(), AgentLayout(), dynamic, metadata, viewport, active(), AgentShell(), DemoBar() (+4 more)

### Community 44 - "3. Offer and pricing"
Cohesion: 0.17
Nodes (11): 3. Offer and pricing, Add-ons, Discounts (the only ones you ever give), Entry offer: Feature Launch Video (the pilot), Guarantee (reduces risk, costs you little), Monthly plans (3-month minimum, then month-to-month), Payment terms, Revenue targets (+3 more)

### Community 46 - "1. Niche and ideal customer"
Cohesion: 0.18
Nodes (10): 1. Niche and ideal customer, Buying triggers (reach out within days of these), Ideal customer profile, Lead score, Niches considered, The niche, Their words (use them in your copy), What they really buy (+2 more)

### Community 47 - "9. Marketing content and ad creatives"
Cohesion: 0.18
Nodes (10): 5 content pillars, 9. Marketing content and ad creatives, Ad creatives, Creative A: "Screenshot vs launch video" (problem-aware), Creative B: "Price anchor" (solution-aware, retargeting), Creative C: "Free teaser" (offer, retargeting), First 30 days of content (calendar), Rules (+2 more)

### Community 48 - "11. Client onboarding and retention"
Cohesion: 0.18
Nodes (10): 11. Client onboarding and retention, Churn warning signs → what to do, Kick-off agenda (45 min), Monthly report template (one page), Monthly rhythm (every client), Onboarding: first 14 days, Referrals, Renewals and upgrades (+2 more)

### Community 49 - "ads-chart.tsx"
Cohesion: 0.38
Nodes (4): recharts, chartColors, sourcePalette, tooltipStyle

### Community 50 - "appsscript.json"
Cohesion: 0.20
Nodes (9): dependencies, enabledAdvancedServices, exceptionLogging, oauthScopes, runtimeVersion, timeZone, webapp, access (+1 more)

### Community 51 - "7. Proposal template"
Cohesion: 0.20
Nodes (9): 7. Proposal template, Before you send, check, Covering email, Investment, Next step, What we heard, What we'll do, What we need from you (+1 more)

### Community 52 - "14. Automating repetitive work"
Cohesion: 0.20
Nodes (9): 14. Automating repetitive work, Already automated in the CRM, SOP 1: New request intake (2 minutes per request), SOP 2: Folder structure (same for every client), SOP 3: Production checklist (every asset), SOP 4: Invoicing and payments, SOP 5: Weekly admin block (Friday, 60 minutes), Templates to keep ready (copy into your email tool's snippets) (+1 more)

### Community 53 - "settings-forms.tsx"
Cohesion: 0.33
Nodes (8): renameWorkspace(), updateOutreachLinks(), updateProfile(), urlField, InlineForm(), OutreachLinksForm(), ProfileForm(), WorkspaceNameForm()

### Community 54 - "5. Outreach sequences and personalisation"
Cohesion: 0.22
Nodes (9): 5. Outreach sequences and personalisation, Channel rules, Personalisation formula, Reply handling (copy these), Sequence 1: Cold outreach, funded SaaS (7 steps, 21 days), Sequence 2: Inbound enquiry (website form, referral, DM), Sequence 3: Proposal follow-up (starts automatically when a lead moves to "Proposal"), Sequence 4: Booked call no-show (+1 more)

### Community 55 - "actions/sequences.ts"
Cohesion: 0.44
Nodes (7): updateLeadStage(), startLeadSequence(), startSchema, stopLeadSequence(), SequenceControls(), startSequence(), stopSequences()

### Community 57 - "00-start-here.md"
Cohesion: 0.25
Nodes (6): Creative Cut go-to-market playbook, Documents, First 30 days, Sources used, The plan in one paragraph, What I couldn't do for you

### Community 58 - "Gmail + Google Calendar को मुफ़्त में जोड़ना (Apps Script, Google Cloud नहीं चाहिए)"
Cohesion: 0.29
Nodes (6): 1. Script बनाएँ (5 मिनट), 2. Secret डालें, 3. Deploy करें, 4. Vercel में URL डालें, 5. जाँचें, Gmail + Google Calendar को मुफ़्त में जोड़ना (Apps Script, Google Cloud नहीं चाहिए)

### Community 59 - "2. Competition"
Cohesion: 0.29
Nodes (6): 2. Competition, Sources, Watch list (check quarterly), Where you shouldn't compete, Why Creative Cut wins, Your position

### Community 60 - "4. Finding customers and generating leads"
Cohesion: 0.29
Nodes (6): 4. Finding customers and generating leads, Daily prospecting routine (45 minutes, every working day), Data and privacy rules, Prospect research checklist (for the lead's notes), Starter list: 11 verified prospects, Where new prospects come from (ranked by quality)

### Community 61 - "6. Sales call script and objection handling"
Cohesion: 0.29
Nodes (6): 6. Sales call script and objection handling, After the call (within 2 hours), Before the call (10 minutes), Closing lines, Discovery call: 25 minutes, Objection handling

### Community 62 - "10. Sales funnel and CRM automation"
Cohesion: 0.29
Nodes (6): 10. Sales funnel and CRM automation, Daily routine in the CRM (20 minutes, every morning), Setup checklist (one time), The funnel, Tracking, What the CRM automates

### Community 63 - "12. Case studies"
Cohesion: 0.29
Nodes (6): 12. Case studies, Example layout (fill with real details only), Questions to ask the client for results, Step 1: Mine the existing portfolio (this week), Step 2: Write each case study (template), Step 3: Use each case study in 5 places

### Community 64 - "app/layout.tsx"
Cohesion: 0.29
Nodes (4): bebas, metadata, satoshi, viewport

### Community 65 - "Creative Cut lead engine — how to run it safely"
Cohesion: 0.33
Nodes (5): App (`/agent`), Commands (from `lead-engine/`), Creative Cut lead engine — how to run it safely, Reading a run, Rules

### Community 67 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, typecheck

### Community 68 - "8. Landing page"
Cohesion: 0.33
Nodes (5): 8. Landing page, Conversion checklist, Rules for any page or ad copy, Structure and copy, Why a separate page

### Community 69 - "13. KPIs, tracking and improving conversion"
Cohesion: 0.33
Nodes (5): 13. KPIs, tracking and improving conversion, Conversion rate optimisation checklist, Friday scorecard (15 minutes, every week), The funnel and target conversion rates, When a number is low, fix this

### Community 70 - "आम Gmail (@gmail.com) को CRM से जोड़ना"
Cohesion: 0.40
Nodes (4): 1. Google Cloud में OAuth client बनाएँ (5 मिनट), 2. Vercel में डालें, 3. Connect करें, आम Gmail (@gmail.com) को CRM से जोड़ना

### Community 71 - "roadmap.ts"
Cohesion: 0.50
Nodes (4): DEPARTMENTS, PLANNED_AGENTS, PlannedAgent, Department

### Community 72 - "eslint-config-next"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint-config-next@16.4.5, eslint-config-next

## Knowledge Gaps
- **3 isolated node(s):** `RFC-8058`, `RFC-4180`, `RFC-2822`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 563 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `simulated()` connect `server-only` to `Creative Cut lead engine`?**
  _High betweenness centrality (0.413) - this node is a cross-community bridge._
- **What connects `RFC-8058`, `RFC-4180`, `RFC-2822` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10546448087431694 - nodes in this community are weakly interconnected._
- **Why does `Database schema` connect `Creative Cut lead engine` to `server-only`?**
  _High betweenness centrality (0.413) - this node is a cross-community bridge._
- **Should `lib/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06038961038961039 - nodes in this community are weakly interconnected._
- **Should `registry.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0660377358490566 - nodes in this community are weakly interconnected._
- **Should `sheet-store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08345428156748912 - nodes in this community are weakly interconnected._