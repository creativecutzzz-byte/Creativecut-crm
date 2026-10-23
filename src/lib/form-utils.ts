/** ISO timestamp → value for <input type="datetime-local"> in the browser's timezone. */
export function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Team members who can own records (signed-up, active). */
export function assignableMembers<T extends { user_id: string | null; full_name: string; status?: string }>(team: T[]) {
  return team.filter((m): m is T & { user_id: string } => Boolean(m.user_id) && (m.status ?? "active") === "active");
}
