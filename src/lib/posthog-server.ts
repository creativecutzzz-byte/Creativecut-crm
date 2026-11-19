import { headers } from "next/headers";
import { PostHog } from "posthog-node";

let client: PostHog | null | undefined;

export function getPostHogClient() {
  if (client !== undefined) return client;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) {
    if (process.env.NODE_ENV !== "production") {
      const variable = token ? "NEXT_PUBLIC_POSTHOG_HOST" : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
      console.warn(`${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`);
    }
    client = null;
    return client;
  }

  client = new PostHog(token, {
    host,
    enableExceptionAutocapture: true,
    privacyMode: false,
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2000,
    fetchRetryCount: 0,
  });
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, boolean | number | string | null | undefined>,
) {
  const posthog = getPostHogClient();
  if (!posthog) return;

  try {
    const sessionId = (await headers()).get("X-POSTHOG-SESSION-ID");
    posthog.capture({
      distinctId,
      event,
      properties: { ...properties, ...(sessionId ? { $session_id: sessionId } : {}) },
    });
    await posthog.flush().catch(() => {});
  } catch {
    // Analytics delivery must not affect the successful application action.
  }
}
