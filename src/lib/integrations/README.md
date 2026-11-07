# Integrations

| Provider | Module | What it does |
| --- | --- | --- |
| WhatsApp Business (Cloud API) | `whatsapp.ts` | Sends text (inside the 24-hour window) or approved templates. |
| Instagram Messaging (Instagram Login) | `instagram.ts` | Replies to DMs by Instagram-scoped id (IGSID). |
| Meta webhook | `src/app/api/webhooks/meta/route.ts` | Verifies `X-Hub-Signature-256`, turns inbound WhatsApp messages and Instagram DMs into messages, activities, tasks and new leads; applies WhatsApp delivery receipts. |
| Meta Ads | `meta-ads.ts` | Analytics only. There is no method to create, edit or launch ads. |

Setup guide (Hindi): [`docs/meta-setup.md`](../../../docs/meta-setup.md).

## Safety

- Nothing is sent unless `MESSAGING_MODE=live` **and** the provider's credentials are set.
  Any other value previews the message (dry-run). Remove the variable to stop all sending.
- Meta's rules are enforced in `src/app/actions/messages.ts`:
  - free-form text only within 24 hours of the person's last inbound message;
  - outside it, WhatsApp sends the selected approved template, and only to leads with `marketing_consent`;
  - Instagram only replies to people who messaged first, within 24 hours.
- Every send (including failures) is logged in `messages`.
- Workflows remain dry-run; they never send automatically.

## Credentials

- Never commit tokens. Use `.env.local` (git-ignored) in development and your host's
  environment variables in production. The UI only shows whether each one is set.
- `SUPABASE_SERVICE_ROLE_KEY` is used only by the webhook, and only to call
  `ingest_inbound_message()` / `update_message_status()` (executable by `service_role` only).
