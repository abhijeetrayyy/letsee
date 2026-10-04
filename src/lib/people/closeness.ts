/**
 * How close someone is, for ordering — never shown (docs/design/RETHINK.md §5).
 *
 * Co-viewings × 3 + passes in either direction × 2 + a message in the last 180
 * days × 1 + a mutual follow × 1, each part fading with the time since the last
 * time it happened (a half-life of sixty days), so the friend you watched
 * everything with three years ago drifts below the one you watched with last
 * week. Computed in the browser from what the People tab already reads, so it
 * costs no query and no job.
 */
export type ClosenessInput = {
  together: number;
  lastTogether: string | null;
  passes: number;
  lastPass: string | null;
  lastMessage: string | null;
  mutual: boolean;
};

const HALF_LIFE_DAYS = 60;
const DAY = 864e5;

function fade(iso: string | null, now: number): number {
  if (!iso) return 0;
  const days = Math.max(0, (now - new Date(iso).getTime()) / DAY);
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

export function closeness(p: ClosenessInput, now = Date.now()): number {
  const messaged = p.lastMessage && now - new Date(p.lastMessage).getTime() <= 180 * DAY ? 1 : 0;
  return (
    p.together * 3 * fade(p.lastTogether, now) +
    p.passes * 2 * fade(p.lastPass, now) +
    messaged * fade(p.lastMessage, now) +
    (p.mutual ? 1 : 0)
  );
}

/** "Your people" is anyone with any of the four. */
export function isOneOfYourPeople(p: ClosenessInput, now = Date.now()): boolean {
  return p.together > 0 || p.passes > 0 || p.mutual || (!!p.lastMessage && now - new Date(p.lastMessage).getTime() <= 180 * DAY);
}
