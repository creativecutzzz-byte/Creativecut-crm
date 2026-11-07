import "server-only";

import { apolloAgent } from "./apollo";
import { callListAgent } from "./call-list";
import { dailyBriefAgent } from "./daily-brief";
import { meetingTrackerAgent } from "./meeting-tracker";
import { metaAdsSyncAgent } from "./meta-ads-sync";
import { enrichmentAgent } from "./enrichment";
import { fundingNewsAgent } from "./funding-news";
import { googleMapsAgent } from "./google-maps";
import { outreachSenderAgent } from "./outreach-sender";
import { outreachWriterAgent } from "./outreach-writer";
import { replyHandlerAgent } from "./reply-handler";
import type { AgentDefinition } from "./types";

/**
 * Live agents, in the order the scheduler runs them: sources, enrichment,
 * calendar sync and replies (so a meeting or reply stops a sequence before
 * anything new is written), writing, sending, then the call list and the
 * morning brief, which report on everything above.
 */
export const AGENTS: AgentDefinition[] = [
  fundingNewsAgent,
  googleMapsAgent,
  apolloAgent,
  enrichmentAgent,
  meetingTrackerAgent,
  replyHandlerAgent,
  outreachWriterAgent,
  outreachSenderAgent,
  callListAgent,
  metaAdsSyncAgent,
  dailyBriefAgent,
];

export function getAgentDefinition(key: string) {
  return AGENTS.find((a) => a.key === key) ?? null;
}
