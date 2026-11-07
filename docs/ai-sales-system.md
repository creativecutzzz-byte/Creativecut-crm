# AI Sales System: वीडियो वाले "50+ Agents" को Creative Cut CRM में बनाना

वीडियो में एक diagram है जिसमें 4 विभाग (Lead Generation, Outreach, Sales Calling, CRM Operations) हैं। इनके ऊपर एक **AI Orchestrator (Main Brain)** है, और साथ में Knowledge layer, Databases, Tools, External data, Analytics, Human oversight और Security हैं।

असल में ये "50 agents" अलग-अलग प्रोग्राम नहीं हैं। ये **एक ही सिस्टम के छोटे-छोटे काम (functions)** हैं, जो एक scheduler (cron) और एक AI model (Claude API) से चलते हैं। हम इन्हें आपके मौजूदा CRM (Next.js + Supabase) के अंदर ही बनाएँगे। इसके लिए कोई अलग n8n/Zapier ढाँचा नहीं चाहिए।

स्थिति: ✅ CRM में पहले से है · 🟡 आधा है · 🔨 बनाना है · 🔑 आपसे account/API key चाहिए · ⚠️ नियम/जोखिम

---

## 0. AI Orchestrator (Main Brain)

| वीडियो में | हमारे CRM में | स्थिति |
| --- | --- | --- |
| Task Planner, Agent Router, Workflow Manager | एक **job queue** (`agent_jobs` table) और **cron** (Vercel Cron, हर 5–15 मिनट), जो तय करे कि कौन-सा काम कब चलेगा | 🔨 |
| Decision Maker, Quality Checker | Claude API से हर मैसेज/lead का फ़ैसला, और भेजने से पहले quality check (tone, ग़लत नाम, spam words) | 🔨 🔑 Anthropic API key |
| Context Manager, Memory & Learning | Lead की पूरी history (messages, activities) + Knowledge layer, जो prompt में जाए | 🟡 |
| Error Handler | Failed jobs का retry, और आपको alert | 🔨 |
| Goal Tracker, Continuous Improvement | KPI targets vs actual (playbook/13) | 🟡 |

## 1. Lead Generation

| Agent | कैसे बनेगा | स्थिति |
| --- | --- | --- |
| Apollo Agent / CRM Search | Apollo API: ICP filter (Indian SaaS, Seed–Series B, founders/marketing heads) से रोज़ N नए prospects | 🔨 🔑 Apollo API (paid plan) |
| Google Maps Agent | Google Places API, local businesses के लिए (आपका second niche: real estate) | 🔨 🔑 Google Cloud key |
| Funding-news Agent (Intent Detection) | Inc42 / Entrackr / YourStory RSS → नई funding वाली कंपनियाँ = सबसे गर्म leads (playbook/01) | 🔨 |
| Website Scraper / Enrichment | Prospect की website पढ़कर Claude निकाले कि वे क्या करते हैं, पिछले videos कैसे हैं, और personalization line क्या होगी | 🔨 |
| Qualification Agent | मौजूदा rule-based score + Claude का reasoning | 🟡 (rule-based ✅) |
| Competitor Finder, Persona Builder | ICP doc (playbook/01) Knowledge layer में | 🟡 |
| LinkedIn / Instagram / Facebook "Lead Agent" | ⚠️ LinkedIn और Instagram को scrape करना या auto-DM करना उनके नियमों के ख़िलाफ़ है, और इससे account ban हो सकता है। विकल्प: Apollo से LinkedIn URL लें, और LinkedIn पर कदम आप खुद उठाएँ (CRM task बनाकर याद दिलाएगा)। Instagram/Facebook पर inbound DMs अब webhook से अपने-आप lead बन जाते हैं ✅ | ⚠️ |

## 2. Outreach

| Agent | कैसे बनेगा | स्थिति |
| --- | --- | --- |
| Sequence Manager | 5 sequences (cold, inbound, proposal, no-show, re-engage) पहले से हैं, पर अभी सिर्फ़ tasks बनाते हैं। इन्हें cron से **अपने-आप भेजने वाला** बनाना है। | 🟡 |
| Email Outreach Agent | Gmail API या Resend/Instantly, एक **अलग sending domain** से (जैसे `creativecut.co`), ताकि मुख्य domain spam में न जाए | 🔨 🔑 domain + email provider |
| WhatsApp Outreach | ✅ जुड़ गया। ⚠️ Cold लोगों को सिर्फ़ approved template जाएगा, और सिर्फ़ opt-in वालों को | ✅ |
| Instagram DM | ✅ सिर्फ़ जवाब (Meta नियम) | ✅ |
| LinkedIn Outreach | ⚠️ ऊपर देखें: आपके लिए task + AI-लिखा मैसेज, आप copy-paste करें | 🟡 |
| SMS | ज़रूरत कम है (B2B)। बाद में Twilio/MSG91 से | ⏭ |
| Personalization Agent | Claude हर lead के लिए first line / पूरा email लिखे (website + funding news से) | 🔨 🔑 |
| Reply Handler / Interested-Lead Filter | आने वाले जवाब (email/WhatsApp/IG) को Claude पढ़े → interested / not now / unsubscribe / question → stage बदले, sequence रोके, और hot lead पर आपको तुरंत WhatsApp alert भेजे | 🔨 |
| Follow-up Agent | Sequence steps + "no reply in X days" workflow | 🟡 |
| A/B Testing, Deliverability Optimizer | Subject/opening के 2 versions → reply rate तुलना; bounce/spam निगरानी | 🔨 |
| Outreach Inbox (Unified) | WhatsApp + Instagram (✅ Recent messages) + Email, एक ही inbox में | 🟡 |

## 3. Sales Calling

| Agent | कैसे बनेगा | स्थिति |
| --- | --- | --- |
| Voice AI (Outbound/Inbound calling) | Vapi या Retell AI + Twilio/Exotel नंबर | 🔨 🔑 ⚠️ |
| Call Script / Objection Handling | playbook/06 पहले से लिखा है → Knowledge layer | 🟡 |
| Meeting Booker | Cal.com या Google Calendar link; booking होने पर stage "Meeting booked" | 🔨 🔑 |
| Call Recording, Summary, Sentiment | Voice provider का transcript → Claude summary → lead activity | 🔨 |

⚠️ **ज़रूरी:** India में AI से cold call करने पर TRAI/DND नियम लागू होते हैं (registered telemarketer, DND check, consent)। US में TCPA लागू होता है। **सलाह:** AI calling सिर्फ़ inbound के लिए रखें, या उन leads के लिए जिन्होंने form भरा/meeting माँगी है। Cold calls आप खुद करें, और AI आपके लिए call list, script और summary तैयार करे।

## 4. CRM Operations

| Agent | स्थिति |
| --- | --- |
| Lead Capture (website form, WhatsApp, Instagram) | ✅ |
| Contact Enrichment | 🔨 (Lead Gen वाला ही) |
| Deal Management, Pipeline Automation, Deal Stage Movement | 🟡 stages ✅, auto-move 🔨 (reply/meeting/proposal पर) |
| Follow-up Tracker, Task & Reminder | ✅ |
| Meeting Scheduler | 🔨 |
| Customer Segmentation | 🟡 tags ✅ |
| Reporting Agent (Daily/Weekly) | 🔨: रोज़ सुबह WhatsApp/email पर: नई leads, replies, meetings, आज के tasks |
| HubSpot/Pipedrive/Zoho sync | ज़रूरत नहीं, आपका अपना CRM है ✅ |

## Knowledge layer, Analytics, Human oversight, Security

- **Knowledge layer**: Company info, services, ICP, case studies, objection handling, scripts। ये सब `playbook/` में पहले से हैं। 🔨 इन्हें DB में डालकर हर AI prompt में इस्तेमाल करना है।
- **Analytics**: Dashboard और funnel ✅; agent performance (कौन-सा sequence/agent कितने replies लाया) 🔨
- **Human oversight**: 🔨 **Approval queue**। AI जो भेजना चाहता है वह पहले "Review" में आए, और आप एक क्लिक में Approve/Edit करें। शुरू के 2–4 हफ़्ते सब कुछ approval से, फिर भरोसा होने पर auto।
- **Security & compliance**: RLS ✅, tokens env में ✅, consent ✅; unsubscribe/opt-out handling 🔨, audit log (messages table) ✅

---

## आपसे क्या-क्या चाहिए (Requirements)

अनुमानित ख़र्च बदलते रहते हैं। Sign up करते समय हर provider की अभी की pricing देख लें।

| # | चीज़ | किसलिए | कब |
| --- | --- | --- | --- |
| 1 | **Vercel पर deploy** + domain (crm.creativecut.in) | Cron, webhooks, सब कुछ | Phase 1 से पहले |
| 2 | **Supabase project** (live) | Database | Phase 1 से पहले |
| 3 | **Anthropic API key** (console.anthropic.com) | AI brain: लिखना, फ़ैसले, reply पढ़ना | Phase 1 |
| 4 | **Apollo.io** API (paid plan) | B2B prospect search + emails | Phase 1 |
| 5 | Google Cloud **Places API** key | Google Maps leads (real estate niche) | Phase 1 (optional) |
| 6 | **Outreach email domain** + Google Workspace mailbox या Resend | Cold email | Phase 2 |
| 7 | WhatsApp templates approved (Meta) | Outreach | Phase 2 |
| 8 | **Cal.com** या Google Calendar booking link | Meeting booking | Phase 3 |
| 9 | Vapi/Retell + Twilio/Exotel नंबर | AI calling | Phase 4 (optional) |

Secret keys कभी चैट में न भेजें। उन्हें सीधे Vercel environment variables में डालें।

---

## Build plan (phases)

**Phase 1: Brain + Lead Generation** *(अभी शुरू)*
- `agent_jobs` / `agent_runs` tables, cron endpoint, Claude client (dry-run fallback अगर key न हो)
- Knowledge layer (playbook → DB)
- Agents: Funding-news finder → Apollo search → Website enrichment → Claude qualification + personalization → lead CRM में
- "Agents" पेज: हर agent on/off, आख़िरी run, नतीजे, errors

**Phase 2: Outreach autopilot**
- Approval queue (Review → Approve/Edit/Reject)
- Sequences का auto-send (email + WhatsApp template), daily limits, quiet hours
- Reply handler (AI classification → stage/sequence/alert)
- Unsubscribe handling

**Phase 3: CRM Ops + Reporting**
- Meeting booking → stage auto-move; proposal follow-ups
- Daily morning brief (WhatsApp/email), weekly report
- Agent performance analytics, A/B testing

**Phase 4: Calling (optional)**
- Inbound/warm AI calls, call summary, call list for manual cold calls

**Learning loop**: हर हफ़्ते replies/meetings के आँकड़ों से prompts और templates सुधारना।
