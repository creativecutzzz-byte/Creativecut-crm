# Google Workspace से Outreach Email जोड़ना (स्टेप-बाय-स्टेप)

CRM आपके Google Workspace mailbox से cold emails भेजेगा और उनके जवाब पढ़ेगा। इसके लिए Google का **service account + domain-wide delegation** इस्तेमाल होता है। इसमें कोई password या token database में नहीं जाता, सब कुछ Vercel के environment variables में रहता है।

> **ज़रूरी:** Private key, service account JSON वगैरह किसी चैट, ईमेल या GitHub में कभी पेस्ट मत करें। इन्हें सिर्फ़ Vercel → Settings → Environment Variables में डालें।

---

## 1. अलग outreach domain (सबसे ज़रूरी)

अपने मुख्य domain (creativecut.in) से cold email **मत** भेजें। अगर spam की शिकायतें आईं, तो आपके normal emails भी spam में जाने लगेंगे।

1. एक मिलता-जुलता domain ख़रीदें, जैसे `creativecut.co` या `trycreativecut.com`। उस domain की website को `creativecut.in` पर redirect कर दें।
2. Google Admin (admin.google.com) → **Account → Domains → Manage domains → Add a domain**। इसे **secondary domain** के रूप में जोड़ें और verify करें।
3. उस domain पर एक नया user बनाएँ, जैसे `aanya@creativecut.co`। यही outreach mailbox होगा।
4. DNS में ये records ज़रूर लगाएँ, नहीं तो emails spam में जाएँगे:
   - **MX**: Google Workspace के MX records
   - **SPF** (TXT): `v=spf1 include:_spf.google.com ~all`
   - **DKIM**: Admin → Apps → Google Workspace → Gmail → **Authenticate email** → नया domain चुनें → *Generate new record* → TXT record DNS में लगाएँ → **Start authentication**
   - **DMARC** (TXT, नाम `_dmarc`): `v=DMARC1; p=none; rua=mailto:aanya@creativecut.co`
5. **Warm-up:** नए mailbox से पहले 2 हफ़्ते रोज़ 10–20 असली emails भेजें और लें। CRM में `daily_email_cap` पहले 20 रखें, और हर हफ़्ते 10 बढ़ाएँ। 40–50 प्रति mailbox प्रति दिन से ऊपर न जाएँ।

---

## 2. Google Cloud में service account

1. console.cloud.google.com → नया project बनाएँ, जैसे `creativecut-crm`।
2. **APIs & Services → Library → Gmail API → Enable**।
3. **IAM & Admin → Service Accounts → Create service account**:
   - नाम: `crm-outreach`
   - Role: कुछ नहीं चाहिए, सीधे **Done** दबाएँ।
4. उस service account को खोलें → **Keys → Add key → Create new key → JSON**। एक JSON file download होगी। इसे सुरक्षित रखें।
5. उसी पेज पर **Unique ID** (Client ID, सिर्फ़ अंकों वाला) कॉपी करें।

> अगर "Service account key creation is disabled" दिखे, तो Organization Policy में `iam.disableServiceAccountKeyCreation` को इस project के लिए बंद करें (IAM & Admin → Organization Policies)।

---

## 3. Domain-wide delegation (Google Admin में)

1. admin.google.com → **Security → Access and data control → API controls → Manage Domain Wide Delegation → Add new**
2. **Client ID**: ऊपर कॉपी किया Unique ID
3. **OAuth scopes**: बिल्कुल यही डालें:
   ```
   https://www.googleapis.com/auth/gmail.modify
   ```
4. **Authorize** दबाएँ। इसे लागू होने में 5 मिनट से 24 घंटे तक लग सकते हैं।

---

## 4. Vercel में values डालना

Download की हुई JSON file खोलें। उसमें से ये values Vercel में डालें:

| Variable | कहाँ से |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON का `client_email` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON का `private_key` (पूरा, `-----BEGIN PRIVATE KEY-----` से `-----END PRIVATE KEY-----` तक; `\n` जैसे हैं वैसे ही रहने दें) |
| `GMAIL_SENDER` | outreach mailbox, जैसे `aanya@creativecut.co` |
| `GMAIL_SENDER_NAME` | email में दिखने वाला नाम, जैसे `Aanya Kapoor` |
| `NEXT_PUBLIC_SITE_URL` | CRM का URL (unsubscribe link के लिए), जैसे `https://crm.creativecut.in` |
| `CRON_SECRET` | कोई भी लंबी रैंडम स्ट्रिंग (unsubscribe link इसी से sign होते हैं) |
| `MESSAGING_MODE` | टेस्ट होने तक `dry-run`, फिर `live` |

इसके बाद **Redeploy** करें, और `supabase db push` से नया migration लगाएँ।

---

## 5. Agents चालू करना

CRM → **AI Agents** → Outreach विभाग:

1. **Outreach Sender → Settings**:
   - `daily_email_cap`: 20 (warm-up के दौरान)
   - `window_start_hour` / `window_end_hour`: 10 / 18 (IST)
   - `send_days`: `[1,2,3,4,5]` (सोम–शुक्र)
   - `postal_address`: आपका business address (email footer में जाता है)
2. **Reply Handler → Settings** → `alert_email`: जहाँ hot replies की सूचना चाहिए, जैसे आपका मुख्य email।
3. **Outreach Writer → Settings** → `min_score` (जैसे 70), `new_leads_per_run` (जैसे 10)। `auto_approve` को **false** रहने दें।
4. पहले तीनों पर **Run now** दबाएँ। फिर **Outreach** पेज पर जाकर messages पढ़ें, ज़रूरत हो तो बदलें, और **Approve & send** करें।
5. सब ठीक लगे तो तीनों के switch **On** करें।

### Cron कितनी बार चले?
`vercel.json` में agents रोज़ सुबह 9 बजे (IST) चलते हैं, क्योंकि Vercel Hobby plan पर cron दिन में एक बार ही चलता है। Replies जल्दी पकड़ने और scheduled emails समय पर भेजने के लिए दो विकल्प हैं:
- **Vercel Pro**: `vercel.json` में schedule `"*/30 * * * *"` कर दें।
- **मुफ़्त विकल्प**: cron-job.org पर हर 30 मिनट का job बनाएँ:
  - URL: `https://<आपका-domain>/api/cron/agents`
  - Header: `Authorization: Bearer <CRON_SECRET>`

Lead-generation agents फिर भी दिन में एक बार ही चलेंगे, क्योंकि हर agent का अपना न्यूनतम अंतराल तय है। Apollo के credits ज़्यादा नहीं लगेंगे।

---

## Autopilot कैसे काम करता है

1. **Outreach Writer**: AI score ≥ `min_score` वाली नई leads को autopilot पर डालता है, और sequence (`cold_saas`) का हर step Claude से personalise करवाता है।
   - Day 0: LinkedIn connection note + Email 1
   - Day 2: LinkedIn engagement
   - Day 3: Email 2 … Day 21: आख़िरी email
2. हर message **Outreach** पेज पर approval के लिए आता है। LinkedIn वाले step आपको खुद भेजने होंगे: **Copy text → Open LinkedIn → "I did this"**। LinkedIn automation की इजाज़त नहीं देता।
3. **Outreach Sender**: approve हुए emails sending hours में भेजता है। Follow-ups उसी email thread में "Re:" के साथ जाते हैं। हर cold email में unsubscribe link होता है।
4. **Reply Handler**: Gmail में आए जवाब पढ़ता है, और WhatsApp/Instagram के जवाब भी। फिर:
   - **interested / meeting / question**: sequence रुकता है, stage "Qualified" होती है, 🔥 task बनता है, alert email जाता है, और Claude का लिखा जवाब approval queue में आता है।
   - **not now**: sequence रुकता है, और 60 दिन (या जो तारीख़ उन्होंने बताई) बाद re-engage task बनता है।
   - **not interested**: lead "Lost" हो जाती है।
   - **unsubscribe**: suppression list में जुड़ जाता है। उसे फिर कभी email नहीं जाएगा, और agents उसे दोबारा import भी नहीं करेंगे।
   - **out of office**: अगले steps आगे खिसक जाते हैं।
   - **bounce**: email "bounced" mark होता है और sequence रुक जाता है।
5. जवाब किसी भी channel पर आए, उस lead के queued steps अपने-आप cancel हो जाते हैं।

## दिक्कत आए तो

| लक्षण | वजह |
| --- | --- |
| "Google sign-in failed: unauthorized_client" | Domain-wide delegation में Client ID या scope ग़लत है, या अभी लागू नहीं हुआ |
| "invalid_grant" | `GMAIL_SENDER` उस Workspace का user नहीं है, या private key ग़लत/अधूरी कॉपी हुई |
| "Gmail API has not been used in project…" | Gmail API enable नहीं किया |
| Emails spam में जा रहे हैं | SPF/DKIM/DMARC जाँचें (mail-tester.com), cap कम करें, links कम रखें |
| Approve करने पर "queued for next window" | Sending hours या daily cap; Outreach Sender की settings देखें |
