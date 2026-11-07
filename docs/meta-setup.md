# WhatsApp और Instagram को CRM से जोड़ना (स्टेप-बाय-स्टेप)

यह गाइड बताती है कि developers.facebook.com पर क्या-क्या करना है, और हर बार कौन-सी वैल्यू कहाँ डालनी है।

> **ज़रूरी:** Access Token, App Secret और Service Role Key किसी चैट, ईमेल या GitHub में कभी पेस्ट मत करें।
> इन्हें सिर्फ़ अपने होस्ट (Vercel → Project → Settings → Environment Variables) में डालें। हर बदलाव के बाद **Redeploy** करें।

---

## 0. पहले से ज़रूरी चीज़ें

- [ ] CRM ऑनलाइन (deployed) होना चाहिए, जैसे `https://crm.creativecut.in`। Webhook localhost पर काम नहीं करता।
- [ ] Supabase जुड़ा हो, और नया migration चल चुका हो: `supabase db push`। इससे `20261107000000_meta_messaging.sql` लग जाएगा।
- [ ] Meta Business account (business.facebook.com)
- [ ] Instagram Professional (Business/Creator) अकाउंट
- [ ] WhatsApp के लिए ऐसा नंबर जो किसी WhatsApp ऐप में चालू न हो

Vercel में ये दो वैल्यू पहले ही डाल दें:

| Variable | कहाँ से |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | आपका CRM URL, जैसे `https://crm.creativecut.in` |
| `META_WEBHOOK_VERIFY_TOKEN` | कोई भी लंबी रैंडम स्ट्रिंग जो आप खुद बनाएँ, जैसे `cc-hook-8f2k19xq` |
| `META_WEBHOOK_WORKSPACE` | CRM → Settings → Website lead capture → **Workspace key** |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (secret) |
| `MESSAGING_MODE` | अभी `dry-run` रखें। सब टेस्ट होने के बाद `live` करें। |

---

## 1. Meta App तैयार करना

1. developers.facebook.com → **My Apps** → अपना ऐप खोलें। अगर ऐप नहीं है, तो **Create App** → Use case: **Other** → Type: **Business** चुनें।
2. ऐप को अपने Business account से जोड़ें: **App settings → Basic → Business portfolio**।
3. **App settings → Basic** में:
   - **App Secret** → Show → इसे Vercel में `META_APP_SECRET` के रूप में डालें।
   - Privacy Policy URL भरें, जैसे `https://creativecut.in/privacy`। Live mode के लिए यह ज़रूरी है।

---

## 2. WhatsApp

1. ऐप Dashboard → **Add product → WhatsApp → Set up**।
2. **WhatsApp → API Setup**:
   - **Add phone number** → अपना बिज़नेस नंबर जोड़ें और OTP से verify करें।
   - उसी नंबर का **Phone number ID** कॉपी करें → Vercel: `WHATSAPP_PHONE_NUMBER_ID`।
3. **Permanent Access Token** बनाएँ। ध्यान रखें, API Setup वाला temporary token 24 घंटे में ख़त्म हो जाता है।
   - business.facebook.com → **Settings → Users → System users → Add** → Role: Admin।
   - **Add assets** → अपना ऐप चुनें (Full control), फिर WhatsApp account चुनें (Full control)।
   - **Generate new token** → ऐप चुनें → Expiration: **Never** → permissions: `whatsapp_business_messaging` और `whatsapp_business_management`।
   - Token → Vercel: `WHATSAPP_ACCESS_TOKEN`।
4. **Webhook**: WhatsApp → **Configuration → Webhook → Edit**:
   - Callback URL: `https://<आपका-domain>/api/webhooks/meta`। यही URL CRM के WhatsApp पेज पर भी दिखता है।
   - Verify token: वही जो `META_WEBHOOK_VERIFY_TOKEN` में डाला है।
   - **Verify and save** → फिर **Webhook fields → messages → Subscribe**।
5. **Templates**: business.facebook.com → **WhatsApp Manager → Message templates → Create**।
   - Body में `{{1}}`, `{{2}}` लिखें।
   - CRM में उसी template का *Meta template name* भरें। CRM template के `{{first_name}}`, `{{company}}` जैसे variables उसी क्रम में `{{1}}`, `{{2}}` बनकर जाएँगे।
   - Template की भाषा: Vercel में `WHATSAPP_TEMPLATE_LANGUAGE` रखें (English = `en`, Hindi = `hi`)।
6. **Payment method**: WhatsApp Manager → Payment settings। Business-initiated templates के लिए Meta चार्ज करता है।
7. `WHATSAPP_DEFAULT_COUNTRY_CODE=91` डालें, ताकि 10 अंकों वाले नंबरों के आगे 91 अपने-आप लग जाए।

**Meta का 24 घंटे वाला नियम:** अगर ग्राहक ने पिछले 24 घंटे में मैसेज किया है, तो आप कुछ भी लिखकर भेज सकते हैं। नहीं किया है, तो सिर्फ़ approved template जाएगा, और CRM उसे सिर्फ़ उन leads को भेजेगा जिनका *marketing consent* ऑन है।

---

## 3. Instagram

1. Instagram ऐप में: **Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages** को ON करें।
2. ऐप Dashboard → **Add product → Instagram → API setup with Instagram login**।
3. **Generate access tokens → Add account** → अपने Instagram अकाउंट से लॉगिन करें। फिर:
   - Token → Vercel: `INSTAGRAM_ACCESS_TOKEN`।
   - वहीं दिखने वाला Instagram account **ID** → Vercel: `INSTAGRAM_BUSINESS_ACCOUNT_ID`।
   - इसी पेज का **Instagram app secret** → Vercel: `INSTAGRAM_APP_SECRET`।
4. **Configure webhooks**:
   - Callback URL: `https://<आपका-domain>/api/webhooks/meta` (वही URL)।
   - Verify token: वही `META_WEBHOOK_VERIFY_TOKEN`।
   - **Verify and save** → `messages` field को **Subscribe** करें।
5. ऐप जब तक **Development mode** में है, सिर्फ़ ऐप में जोड़े गए लोग (Roles → Instagram testers) ही काम करेंगे। सबके लिए चालू करने के लिए **App Review** में `instagram_business_manage_messages` permission माँगें, फिर ऐप को **Live** करें।
6. Instagram token हर 60 दिन में ख़त्म होता है। उससे पहले उसे refresh करके Vercel में बदलना होगा।

**Instagram का नियम:** आप सिर्फ़ उसी को DM कर सकते हैं जिसने पहले आपको DM किया हो, और वह भी 24 घंटे के अंदर। जैसे ही कोई DM करता है, CRM में उसकी lead अपने-आप बन जाती है, या पहले से मौजूद @handle से मिल जाती है। उसके बाद आप उसे CRM से जवाब दे सकते हैं।

---

## 4. टेस्ट और Live करना

1. Vercel में सारे variables डालकर **Redeploy** करें।
2. CRM → WhatsApp / Instagram पेज खोलें। "Connection" कार्ड में हर variable के आगे **set** दिखना चाहिए।
3. अपने निजी फ़ोन से बिज़नेस नंबर पर WhatsApp करें, और Instagram पर DM करें। वह मैसेज CRM के **Recent messages** में दिखना चाहिए, साथ में एक नई lead और "Reply" task बनना चाहिए।
4. सब ठीक हो तो Vercel में `MESSAGING_MODE=live` करें → Redeploy। अब "Send" बटन असली मैसेज भेजेगा।
5. सब कुछ रोकना हो, तो `MESSAGING_MODE` हटाएँ या `dry-run` करें → Redeploy।

## दिक्कत आए तो

| लक्षण | वजह |
| --- | --- |
| Webhook verify fail | Verify token मेल नहीं खाता, या CRM deploy नहीं हुआ / URL ग़लत है |
| मैसेज CRM में नहीं आ रहे | `SUPABASE_SERVICE_ROLE_KEY` या `META_WEBHOOK_WORKSPACE` missing है, `messages` field subscribe नहीं हुआ, या Instagram पर "Allow access to messages" बंद है |
| "Invalid signature" (Vercel logs में 401) | `META_APP_SECRET` / `INSTAGRAM_APP_SECRET` ग़लत है |
| WhatsApp error 131047 | 24 घंटे की window बंद है, template भेजें |
| WhatsApp error 132001 | Template का नाम या भाषा मेल नहीं खाती |
| Token expired | WhatsApp के लिए System User token बनाएँ। Instagram token refresh करें। |
