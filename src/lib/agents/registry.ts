import "server-only";

import { apolloAgent } from "./apollo";
import { enrichmentAgent } from "./enrichment";
import { fundingNewsAgent } from "./funding-news";
import { googleMapsAgent } from "./google-maps";
import type { AgentDefinition } from "./types";

/** Live agents, in the order the scheduler runs them (sources first, then enrichment). */
export const AGENTS: AgentDefinition[] = [fundingNewsAgent, googleMapsAgent, apolloAgent, enrichmentAgent];

export function getAgentDefinition(key: string) {
  return AGENTS.find((a) => a.key === key) ?? null;
}
