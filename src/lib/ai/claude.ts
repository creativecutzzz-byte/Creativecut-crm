import "server-only";

import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Anthropic as PostHogAnthropic } from "@posthog/ai/anthropic";
import { getPostHogClient } from "@/lib/posthog-server";
import type { z } from "zod/v4";

// The agents' "brain": one structured-output call per decision.
//
// - Model: ANTHROPIC_MODEL, default claude-opus-5-5. Set it to e.g.
//   claude-haiku-5-5 to cut cost on high-volume enrichment.
// - Effort: ANTHROPIC_EFFORT, default "low" — extraction and scoring don't
//   need deep reasoning.
// - Refusals fall back server-side (fallbacks: "default").

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT || "low") as "low" | "medium" | "high" | "xhigh" | "max";

/** AI is on when a key is set, unless AI_ENABLED=false (e.g. no API credit yet): agents then use their rule-based fallbacks. */
export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AI_ENABLED !== "false";
}

export interface AiObservabilityContext {
  sessionId: string;
  traceId: string;
  distinctId?: string;
}

export function createAiObservabilityContext(distinctId?: string, sessionId = `agent-run:${randomUUID()}`): AiObservabilityContext {
  return { sessionId, traceId: randomUUID(), ...(distinctId ? { distinctId } : {}) };
}

let client: Anthropic | PostHogAnthropic | null = null;
function getClient() {
  if (client) return client;

  const posthog = getPostHogClient();
  client = posthog
    ? new PostHogAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, posthog, maxRetries: 3, timeout: 120_000 })
    : new Anthropic({ maxRetries: 3, timeout: 120_000 });
  return client;
}

export class AiError extends Error {}

/**
 * Asks Claude for JSON matching `schema`. `system` should be stable across
 * calls (it is cached); put the per-item data in `input`.
 */
export async function extract<S extends z.ZodType>(schema: S, system: string, input: string, maxTokens = 4000, observability?: AiObservabilityContext): Promise<z.infer<S>> {
  if (!isAiConfigured()) throw new AiError("ANTHROPIC_API_KEY is not set.");
  const request = {
    model: AI_MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
    system: [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }],
    messages: [{ role: "user" as const, content: input }],
  };
  const aiClient = getClient();
  const monitoredRequest = {
    ...request,
    posthogTraceId: observability?.traceId,
    posthogProperties: observability ? { $ai_session_id: observability.sessionId } : undefined,
    posthogDistinctId: observability?.distinctId,
  };
  const response = aiClient instanceof PostHogAnthropic && observability
    ? await aiClient.beta.messages.parse(monitoredRequest)
    : await aiClient.beta.messages.parse(request);
  if (response.stop_reason === "refusal") throw new AiError(`Claude declined this request${response.stop_details?.category ? ` (${response.stop_details.category})` : ""}.`);
  if (response.stop_reason === "max_tokens") throw new AiError("Claude's answer was cut off (max_tokens).");
  if (!response.parsed_output) throw new AiError("Claude returned output that didn't match the expected format.");
  return response.parsed_output as z.infer<S>;
}
