import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ maxRetries: 3, timeout: 120_000 });
  return client;
}

export class AiError extends Error {}

/**
 * Asks Claude for JSON matching `schema`. `system` should be stable across
 * calls (it is cached); put the per-item data in `input`.
 */
export async function extract<S extends z.ZodType>(schema: S, system: string, input: string, maxTokens = 4000): Promise<z.infer<S>> {
  if (!isAiConfigured()) throw new AiError("ANTHROPIC_API_KEY is not set.");
  const response = await getClient().beta.messages.parse({
    model: AI_MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: input }],
  });
  if (response.stop_reason === "refusal") throw new AiError(`Claude declined this request${response.stop_details?.category ? ` (${response.stop_details.category})` : ""}.`);
  if (response.stop_reason === "max_tokens") throw new AiError("Claude's answer was cut off (max_tokens).");
  if (!response.parsed_output) throw new AiError("Claude returned output that didn't match the expected format.");
  return response.parsed_output as z.infer<S>;
}
