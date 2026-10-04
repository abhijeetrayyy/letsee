/**
 * How a link you sent is doing, in one line (Links you've sent). Plain
 * function, tested (tests/unit/link-state.test.ts).
 */
export function linkState(l: { expiresAt: string; revokedAt: string | null; opened: number }, now = Date.now()): { live: boolean; line: string } {
  const opened = l.opened === 0 ? "Not opened yet" : l.opened === 1 ? "Opened once" : `Opened ${l.opened} times`;
  if (l.revokedAt) return { live: false, line: `Stopped · ${opened.toLowerCase()}` };
  const left = Math.ceil((new Date(l.expiresAt).getTime() - now) / 864e5);
  if (left <= 0) return { live: false, line: `Ran out · ${opened.toLowerCase()}` };
  return { live: true, line: `${opened} · ${left === 1 ? "1 day" : `${left} days`} left` };
}
