# Gmail + Google Calendar को मुफ़्त में जोड़ना (Apps Script, Google Cloud नहीं चाहिए)

यह सबसे आसान तरीका है। आपके `creativecutzzz@gmail.com` पर एक छोटी script चलेगी, जिसे CRM एक secret के साथ बुलाएगा।

**इससे ये काम होंगे:**
- Booking page पर free/busy दिखेगा, और Google Meet के साथ meeting बनेगी।
- Calendar से meetings अपने-आप sync होंगी (Meeting Tracker)।
- Hot-reply alerts, "meeting booked" emails और सुबह का brief इसी Gmail से जाएँगे।

**सीमाएँ:**
- Gmail दिन में सिर्फ़ 100 emails भेजने देता है। Alerts के लिए यह काफ़ी है।
- Cold outreach के जवाब अपने-आप नहीं पढ़े जाएँगे। उसके लिए Google Workspace चाहिए।

## 1. Script बनाएँ (5 मिनट)

1. https://script.google.com खोलें। `creativecutzzz@gmail.com` से login होना चाहिए।
2. **New project** दबाएँ। ऊपर नाम बदलकर `Creative Cut CRM` रखें।
3. बाईं ओर ⚙️ **Project Settings** → ✅ **Show "appsscript.json" manifest file in editor**।
4. बाईं ओर **Editor** (`< >`) पर वापस जाएँ:
   - `Code.gs` का सारा text हटाएँ और इस repo की `docs/apps-script/Code.gs` file का पूरा text paste करें।
   - `appsscript.json` खोलें, उसका सारा text हटाएँ और `docs/apps-script/appsscript.json` paste करें।
   - 💾 **Save** (Ctrl+S) करें।

## 2. Secret डालें

1. Vercel → project → Settings → Environment Variables में `GOOGLE_SCRIPT_SECRET` नाम की value मैंने पहले से डाल दी है। उसकी value 👁 दबाकर कॉपी करें।
2. Apps Script → ⚙️ **Project Settings** → नीचे **Script Properties** → **Add script property**:
   - Property: `SECRET`
   - Value: जो कॉपी किया
   - **Save** दबाएँ।

## 3. Deploy करें

1. ऊपर दाएँ **Deploy → New deployment** दबाएँ।
2. ⚙️ (Select type) → **Web app** चुनें।
   - Execute as: **Me (creativecutzzz@gmail.com)**
   - Who has access: **Anyone**
3. **Deploy** दबाएँ, फिर **Authorize access** → अपना account चुनें।
4. "Google hasn't verified this app" दिखे तो **Advanced → Go to Creative Cut CRM (unsafe) → Allow** दबाएँ। यह आपकी अपनी script है, इसलिए ठीक है।
5. एक **Web app URL** दिखेगा, जो `/exec` पर ख़त्म होता है। उसे कॉपी करें।

## 4. Vercel में URL डालें

Vercel → Environment Variables → **Add**:
- Key: `GOOGLE_SCRIPT_URL`
- Value: ऊपर वाला `/exec` URL
- Type: Sensitive, Environment: Production

फिर **Redeploy** करें (या मुझे बताइए, मैं कर दूँगा)।

## 5. जाँचें

- CRM → **Settings** → Google account पर "Connected via Apps Script (free)" दिखना चाहिए।
- **AI Agents** → **Meeting Tracker & Booking** → **Run now** दबाएँ। "Calendar synced…" दिखना चाहिए।
- Booking page खोलकर खाली slots देखें: `https://crm.creativecut.in/book?w=creative-cut-19f1f4`

**सुरक्षा:** "Anyone" access के बावजूद script सिर्फ़ उसी request का जवाब देती है जिसमें सही `SECRET` हो। अगर secret कहीं leak हो जाए, तो Vercel और Script Properties, दोनों जगह उसे बदल दें। Script बंद करनी हो तो **Deploy → Manage deployments → Archive** करें।

Script में कोई बदलाव करें तो **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** से नया version चलाएँ। URL वही रहता है।
