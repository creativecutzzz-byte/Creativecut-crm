# आम Gmail (@gmail.com) को CRM से जोड़ना

इससे दो काम होते हैं:
- **Booking calendar:** meetings इसी Gmail के Google Calendar पर Google Meet link के साथ बनती हैं।
- **Alerts और daily brief:** ये emails इसी account से भेजे जाते हैं।

अगर आपके पास Google Workspace है, तो `docs/google-workspace-setup.md` वाला तरीका बेहतर है। उससे replies पढ़ना और cold emails भेजना भी होता है।

## 1. Google Cloud में OAuth client बनाएँ (5 मिनट)

1. console.cloud.google.com पर `creativecutzzz@gmail.com` से login करें, फिर नया project बनाएँ: `creative-cut-crm`।
2. **APIs & Services → Library** में **Gmail API** और **Google Calendar API**, दोनों Enable करें।
3. **APIs & Services → OAuth consent screen** (या "Google Auth Platform"):
   - User type: **External**
   - App name: `Creative Cut CRM`, support email: आपका email
   - **Audience** में जाकर **Publish app** करके status "In production" करें। "Testing" में छोड़ा तो token 7 दिन में बंद हो जाता है।
4. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `https://crm.creativecut.in/api/google/callback`
   - **Create** दबाएँ। अब **Client ID** और **Client secret** कॉपी करें।

## 2. Vercel में डालें

Vercel → project → Settings → Environment Variables में दो keys जोड़ें (type **Sensitive**, environment **Production**):

| Key | Value |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Client secret |

फिर **Redeploy** करें।

## 3. Connect करें

1. CRM → **Settings → Google account → Connect Google** दबाएँ।
2. `creativecutzzz@gmail.com` चुनें।
3. "Google hasn't verified this app" दिखे तो **Advanced → Go to Creative Cut CRM (unsafe)** दबाएँ। यह आपका अपना app है, इसलिए ठीक है।
4. सारी permissions पर ✅ लगाकर **Continue** दबाएँ।
5. अगले page पर दो values दिखेंगी: `GOOGLE_OAUTH_EMAIL` और `GOOGLE_OAUTH_REFRESH_TOKEN`। इन्हें Vercel में (type Sensitive) डालें और **Redeploy** करें।
6. Settings में "Connected: creativecutzzz@gmail.com" दिखेगा। अब booking page और alerts चालू हैं।

Token कभी चैट या email में मत भेजिए। अगर access हटाना हो, तो myaccount.google.com/permissions पर जाकर CRM का access हटा दें।
