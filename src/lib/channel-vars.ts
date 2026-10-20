import { memberByUserId } from "./team";
import type { Lead, TeamMember } from "./types";

/** Variables available to message templates for a given lead. */
export function templateVars(lead: Lead, team: TeamMember[]): Record<string, string> {
  const owner = memberByUserId(team, lead.owner_id);
  return {
    first_name: lead.name.split(" ")[0] ?? lead.name,
    company: lead.company ?? lead.name,
    owner_name: owner?.full_name.split(" ")[0] ?? "the Creative Cut team",
    service: lead.service_interest[0]?.toLowerCase() ?? "your project",
    case_study_url: "creativecut.studio/work",
    packages_url: "creativecut.studio/packages",
  };
}
