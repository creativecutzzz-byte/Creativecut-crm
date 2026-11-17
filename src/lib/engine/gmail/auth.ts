import { google, type gmail_v1 } from "googleapis";

// Acts as any mailbox in the Workspace through a service account with
// domain-wide delegation (docs/guide.md, Step 3). Authorise these scopes for
// the service account's Client ID in Admin console -> Security -> API controls
// -> Domain-wide delegation:
//   https://www.googleapis.com/auth/gmail.send
//   https://www.googleapis.com/auth/gmail.readonly
//
// Key: GOOGLE_SA_KEY_B64 (base64 of the JSON key). For an existing CRM setup,
// GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_KEY work too.

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export function serviceAccountKey(): ServiceAccountKey | null {
  const b64 = process.env.GOOGLE_SA_KEY_B64;
  if (b64) {
    const key = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as ServiceAccountKey;
    if (key.client_email && key.private_key) return key;
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const pem = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (email && pem) return { client_email: email, private_key: pem.replace(/\\n/g, "\n") };
  return null;
}

export function isGmailConfigured() {
  try {
    return serviceAccountKey() !== null;
  } catch {
    return false;
  }
}

const cache = new Map<string, gmail_v1.Gmail>();

export function gmailFor(mailbox: string): gmail_v1.Gmail {
  const cached = cache.get(mailbox);
  if (cached) return cached;
  const key = serviceAccountKey();
  if (!key) throw new Error("Google service account is not configured (GOOGLE_SA_KEY_B64).");
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: GMAIL_SCOPES,
    subject: mailbox, // the mailbox to act as
  });
  const client = google.gmail({ version: "v1", auth });
  cache.set(mailbox, client);
  return client;
}
