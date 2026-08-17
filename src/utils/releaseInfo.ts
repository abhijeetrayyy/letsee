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
    /**
     * Formatted by hand rather than by `toLocaleDateString(undefined, …)`.
     *
     * That `undefined` means "the runtime's default locale", and the runtime is
     * two different machines: Node resolves it from the server's ICU default
     * ("Dec 5, 1997") while the browser resolves it from the viewer's settings
     * ("5 Dec 1997"). React then hydrates a text node that does not match the
     * one it rendered, which throws "Hydration failed because the server
     * rendered text..." and forces a full client re-render of the tree — on
     * every page that renders a MediaCard with a date, which is most of them.
     *
     * A date is not a good place to be clever. These two strings are the same
     * everywhere, and they match the person page's own vitals formatting.
     */
    full: `${d} ${MONTHS[m - 1]} ${y}`,
    short: `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`,
    year: String(y),
  };
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** 21080 → "21K". Cards can't spare the width for the exact count. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
