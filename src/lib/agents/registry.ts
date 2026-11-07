import "server-only";

import { apolloAgent } from "./apollo";
import { enrichmentAgent } from "./enrichment";
import { fundingNewsAgent } from "./funding-news";
import { googleMapsAgent } from "./google-maps";
import { outreachSenderAgent } from "./outreach-sender";
import { outreachWriterAgent } from "./outreach-writer";
import { replyHandlerAgent } from "./reply-handler";
import type { AgentDefinition } from "./types";

/**
 * Live agents, in the order the scheduler runs them: sources, enrichment,
 * then replies (so a reply stops a sequence before anything new is written),
 * writing, and sending last.
 */
export const AGENTS: AgentDefinition[] = [fundingNewsAgent, googleMapsAgent, apolloAgent, enrichmentAgent, replyHandlerAgent, outreachWriterAgent, outreachSenderAgent];

export function getAgentDefinition(key: string) {
  return AGENTS.find((a) => a.key === key) ?? null;
}
