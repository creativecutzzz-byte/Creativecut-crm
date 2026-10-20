# Integrations

All three integrations are **placeholders running in dry-run mode**.

| Provider | Module | What it does today |
| --- | --- | --- |
| WhatsApp Business (Cloud API) | `whatsapp.ts` | Renders a template and returns a `simulated` result. No HTTP request. |
| Instagram Messaging | `instagram.ts` | Same — previews the DM, sends nothing. |
| Meta Ads | `meta-ads.ts` | Analytics only. There is no method to create, edit or launch ads. |

`DRY_RUN` in `safety.ts` is a compile-time constant, not an env var, so a
misconfigured deployment can't start messaging customers. Going live requires a
reviewed code change.

## Credentials

- Never commit tokens. Use `.env.local` (git-ignored) in development and your
  host's secret manager (e.g. Vercel env vars) or **Supabase Vault** in production.
- The `integrations` table stores only non-secret config and a `secret_ref`
  (the Vault secret's name) — never the token itself.
- `hasCredentials()` only checks presence; values are never returned to the
  browser or logged.

## Before going live (checklist)

1. Meta Business verification + WhatsApp message templates approved.
2. Webhook routes with signature verification (`X-Hub-Signature-256`).
3. Respect `leads.marketing_consent` — workflows already skip leads without it.
4. Rate limiting and an audit trail in `messages`.
5. Meta Ads: request `ads_read` only.
