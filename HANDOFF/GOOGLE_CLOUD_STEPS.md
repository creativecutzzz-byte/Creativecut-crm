# Google Cloud + Vercel setup steps

1. https://shell.cloud.google.com → `gcloud config set project creative-cut-leads`
2. `git clone -b claude/zen-thompson-dma7ne https://github.com/creativecutzzz-byte/Creativecut-crm.git && cd Creativecut-crm/lead-engine && bash deploy/deploy.sh`
3. `gcloud iam service-accounts keys create app-key.json --iam-account cc-lead-app@creative-cut-leads.iam.gserviceaccount.com` → पूरा JSON copy
4. OAuth: console.cloud.google.com/apis/credentials → OAuth client ID → Web application →
   redirect URI `https://creative-cut-lead-agent.vercel.app/api/agent/gmail/callback`
5. Vercel → creative-cut-lead-agent → Settings → Environment Variables (Production):
   `AGENT_SERVICE_ACCOUNT_KEY`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET` → Redeploy
6. App खोलो → Settings → Connections → Gmail → Connect with Google
7. Home → "Preview run" → Leads में drafts approve → आखिर में "Turn on live sending"
