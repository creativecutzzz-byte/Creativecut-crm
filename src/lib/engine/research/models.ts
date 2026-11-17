import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import { logEvent } from "../db/queries";

// Model chain with fallback (docs/guide.md, Step 6). MODEL_CHAIN lists model IDs
// in order; when one is overloaded, rate-limited, times out or returns unusable
// output, the call falls through to the next. Small tasks (ICP scoring, reply
// classification, faithfulness check) use SMALL_MODEL_CHAIN.

export const DEFAULT_CHAIN = ["claude-sonnet-5-5", "claude-haiku-5-5"];
export const DEFAULT_SMALL_CHAIN = ["claude-haiku-5-5", "claude-sonnet-5-5"];

const parseChain = (v: string | undefined, fallback: string[]) => {
  const list = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : fallback;
};

export const modelChain = () => parseChain(process.env.MODEL_CHAIN, DEFAULT_CHAIN);
export const smallModelChain = () => parseChain(process.env.SMALL_MODEL_CHAIN, DEFAULT_SMALL_CHAIN);

export function isAiReady() {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.AI_ENABLED !== "false";
}

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 1, timeout: 60_000 }));

export class ChainExhaustedError extends Error {}

export interface ChainResult<T> {
  model: string;
  data: T;
}

/**
 * Asks the chain for JSON matching `schema`. `system` is stable (cached);
 * `input` carries the per-lead data. Tries each model once, in order.
 */
export async function jsonWithFallback<S extends z.ZodType>(
  schema: S,
  system: string,
  input: string,
  opts: { chain?: string[]; maxTokens?: number; effort?: "low" | "medium" | "high"; purpose: string },
): Promise<ChainResult<z.infer<S>>> {
  const chain = opts.chain ?? modelChain();
  const errors: string[] = [];
  for (const model of chain) {
    try {
      const serverFallback = !model.startsWith("claude-haiku");
      const response = await anthropic().beta.messages.parse({
        model,
        max_tokens: opts.maxTokens ?? 2000,
        ...(serverFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(schema) },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: input }],
      });
      if (response.stop_reason === "refusal") throw new Error("refused");
      if (response.stop_reason === "max_tokens") throw new Error("output cut off (max_tokens)");
      if (!response.parsed_output) throw new Error("output did not match the schema");
      return { model, data: response.parsed_output as z.infer<S> };
    } catch (err) {
      const reason =
        err instanceof Anthropic.RateLimitError ? "rate_limited"
        : err instanceof Anthropic.InternalServerError ? `server_error ${err.status}`
        : err instanceof Anthropic.APIConnectionTimeoutError ? "timeout"
        : err instanceof Anthropic.APIConnectionError ? "connection_error"
        : err instanceof Anthropic.APIError ? `api_error ${err.status}`
        : err instanceof Error ? err.message : String(err);
      errors.push(`${model}: ${reason}`);
      await logEvent("model_failed", { model, purpose: opts.purpose, error: reason });
      // Auth/permission errors won't be fixed by another model of the same vendor.
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) break;
    }
  }
  throw new ChainExhaustedError(`All models in the chain failed (${errors.join("; ")})`);
}
