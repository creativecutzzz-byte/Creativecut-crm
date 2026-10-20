/** Finds a team member by auth user id. Invited members have no user id yet, so a null id never matches. */
export function memberByUserId<T extends { user_id: string | null }>(team: T[], userId: string | null | undefined): T | undefined {
  return userId ? team.find((m) => m.user_id === userId) : undefined;
}
