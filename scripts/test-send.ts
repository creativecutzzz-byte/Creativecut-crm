// npm run test-send -- <from-mailbox> <to-address>
// Sends one plain-text test email as <from-mailbox> through the service account
// and prints the Gmail message id and thread id (docs/guide.md, Step 3).
// Use your own test address, never a prospect.
import { existsSync, readFileSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) throw new Error("Usage: npm run test-send -- <from-mailbox> <to-address>");
  const { gmailFor } = await import("../src/lib/engine/gmail/auth");
  const { rawMessage, newMessageId } = await import("../src/lib/engine/gmail/message");
  const raw = rawMessage({
    from,
    to,
    subject: "Outreach engine test",
    body: "This is a plain-text test email from the outreach engine.\n\nIf you can read this, sending works.",
    messageId: newMessageId(from),
    unsubMailto: from,
    unsubUrl: "https://example.com/unsubscribe",
  });
  const res = await gmailFor(from).users.messages.send({ userId: "me", requestBody: { raw } });
  console.log(`Sent. Gmail message id: ${res.data.id}  thread id: ${res.data.threadId}`);
}

main().catch((err) => {
  const msg = err?.response?.data?.error_description || err?.response?.data?.error?.message || err?.message || String(err);
  console.error(`Send failed: ${msg}`);
  process.exit(1);
});
