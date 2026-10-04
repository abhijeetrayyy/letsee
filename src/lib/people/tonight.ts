/**
 * Opening Tonight with people already in it (docs/design/RETHINK.md, rooms
 * absorb Tonight): a room's *Decide tonight* and Home's and Up next's
 * *Decide with…* say who, as `/app/tonight?with=priya,sam`. Plain functions,
 * tested (tests/unit/tonight-prefill.test.ts).
 */

/** At most this many people arrive prefilled; Tonight itself allows eight with you. */
export const MAX_PREFILL = 7;

export function tonightHref(usernames: string[]): string {
  const names = [...new Set(usernames.map((u) => u.trim()).filter(Boolean))].slice(0, MAX_PREFILL);
  return names.length ? `/app/tonight?with=${names.map(encodeURIComponent).join(",")}` : "/app/tonight";
}

export function readWith(param: string | null): string[] {
  if (!param) return [];
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  return [...new Set(param.split(",").map((s) => decode(s).trim().toLowerCase()).filter(Boolean))].slice(0, MAX_PREFILL);
}

/**
 * The ids to preselect: only people you're connected to — the same rule the
 * API enforces — so a hand-edited link can't put a stranger in the room.
 */
export function prefillIds(people: { userId: string; username: string }[], wanted: string[]): Set<string> {
  const want = new Set(wanted.map((w) => w.toLowerCase()));
  return new Set(people.filter((p) => want.has(p.username.toLowerCase())).map((p) => p.userId));
}

/**
 * Who in a Tonight session you may not bring: everyone except you, people
 * you're connected to (a follow either way), and — in a group's session —
 * the group's active members. The API refuses the session if this is
 * non-empty, so a stranger's watchlist can't be read through the reasons.
 */
export function strangersIn(participantIds: string[], me: string, connected: Set<string>, groupMembers: Set<string> = new Set()): string[] {
  return participantIds.filter((id) => id !== me && !connected.has(id) && !groupMembers.has(id));
}
