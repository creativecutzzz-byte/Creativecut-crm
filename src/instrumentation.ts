import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if ((!token || !host) && process.env.NODE_ENV !== "production") {
  const variable = token ? "NEXT_PUBLIC_POSTHOG_HOST" : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
  console.warn(`${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`);
}

export const loggerProvider = token && host
  ? new LoggerProvider({
      resource: resourceFromAttributes({ "service.name": "creativecut-crm" }),
      processors: [
        new BatchLogRecordProcessor({
          exporter: new OTLPLogExporter({
            url: `${host}/i/v1/logs`,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }),
        }),
      ],
    })
  : null;

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && loggerProvider) {
    process.once("beforeExit", () => {
      void loggerProvider.shutdown().catch(() => {});
    });
  }
}
