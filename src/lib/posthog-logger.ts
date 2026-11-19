import "server-only";

import { SeverityNumber } from "@opentelemetry/api-logs";
import { loggerProvider } from "@/instrumentation";

const logger = loggerProvider?.getLogger("posthog-exporter");

type LogAttributes = Record<string, boolean | number | string>;

/** Emits only purpose-written application logs to the isolated PostHog exporter. */
export function logPostHogInfo(body: string, attributes: LogAttributes) {
  logger?.emit({
    body,
    severityNumber: SeverityNumber.INFO,
    attributes,
  });
}
