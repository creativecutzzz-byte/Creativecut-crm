import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

export type Department = "brain" | "lead_generation" | "outreach" | "sales_calling" | "crm_operations";

export interface AgentContext {
  supabase: SupabaseClient;
  orgId: string;
  /** Workspace owner: new leads and tasks are assigned to them. */
  ownerId: string | null;
  /** Small cursor the agent keeps between runs (e.g. the next Apollo page). */
  state: Record<string, unknown>;
}

export interface AgentResult {
  status: "success" | "skipped";
  summary: string;
  created: number;
  updated: number;
  state?: Record<string, unknown>;
}

export interface AgentDefinition<C = Record<string, unknown>> {
  key: string;
  name: string;
  department: Department;
  description: string;
  /** Server env vars the agent can't run without. */
  requires: string[];
  needsAi: boolean;
  configSchema: z.ZodType<C>;
  defaultConfig: C;
  /** Plain-language help for the settings, shown next to the editor. */
  configHelp: string;
  run(ctx: AgentContext, config: C): Promise<AgentResult>;
}

export function defineAgent<C>(agent: AgentDefinition<C>) {
  return agent as unknown as AgentDefinition<Record<string, unknown>>;
}
