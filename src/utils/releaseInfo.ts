/**
 * Reading TMDB's release dates the same way everywhere.
 *
 * TMDB sends plain calendar dates ("2026-12-16"). `new Date("2026-12-16")`
 * parses that as UTC midnight, so anyone west of UTC renders the day before —
 * a US viewer would see Parasite released "29 May 2019". These are calendar
 * dates with no time attached, so they're built as local dates instead.
 */
export type ReleaseInfo = {
  /** Parsed as a local calendar date, or null if TMDB had no date. */
  date: Date | null;
  /** Not out yet. Something releasing today counts as out. */
  isUpcoming: boolean;
  /** "16 December 2026" */
  full: string | null;
  /** "16 Dec 2026" — for cards, where space is tight. */
  short: string | null;
  /** "2026" */
  year: string | null;
};

const EMPTY: ReleaseInfo = { date: null, isUpcoming: false, full: null, short: null, year: null };

export function releaseInfo(raw?: string | null): ReleaseInfo {
  if (!raw) return EMPTY;

  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return EMPTY;

  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return EMPTY;

  // Compare calendar day to calendar day: a film out today is out.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    date,
    isUpcoming: date.getTime() > today.getTime(),
    full: date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
    short: date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    year: String(y),
  };
}

/** 21080 → "21K". Cards can't spare the width for the exact count. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
