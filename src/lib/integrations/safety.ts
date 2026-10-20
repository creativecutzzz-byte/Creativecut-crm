import "server-only";

/**
 * Hard safety switch for every outbound integration.
 *
 * This build of the CRM is intentionally incapable of sending real messages or
 * launching ads. There is no environment variable that turns this off — going
 * live must be a deliberate code change, reviewed, with provider credentials
 * stored in Supabase Vault or server env vars (never in the database or repo).
 */
export const DRY_RUN = true as const;

export interface SimulatedResult {
  status: "simulated";
  provider: string;
  preview: string;
  reason: string;
  simulated_at: string;
}

export function simulated(provider: string, preview: string): SimulatedResult {
  return {
    status: "simulated",
    provider,
    preview,
    reason: "Dry-run mode: nothing was sent to the provider.",
    simulated_at: new Date().toISOString(),
  };
}

/** Whether the env holds credentials for a provider. Values are never returned or logged. */
export function hasCredentials(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

export function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
