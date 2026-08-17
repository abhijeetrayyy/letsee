/**
 * Dates on a person page, done properly.
 *
 * The page rendered TMDB's raw string — "Born 1970-07-30" — which is both the
 * wrong format for every locale and missing the number people actually came
 * for. Nobody wants the date; they want the age. And for someone who has died,
 * the current age is not merely useless, it is wrong: what you want is how old
 * they were when they died.
 *
 * All arithmetic is calendar arithmetic on the parsed parts, never
 * `new Date(a) - new Date(b)`. TMDB dates are bare `YYYY-MM-DD` with no zone,
 * so `new Date("1970-07-30")` is parsed as UTC midnight and then read back in
 * local time — which in any negative-offset timezone silently becomes the 29th,
 * and shifts a 1 January birthday into the previous year.
 */

export type ParsedDate = { y: number; m: number; d: number };

/** `YYYY-MM-DD` → parts. Returns null for anything else, including "" and null. */
export function parseTmdbDate(value: string | null | undefined): ParsedDate | null {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // TMDB does emit 0000-00-00 and month 00 for unknown dates.
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/**
 * Whole years between two dates, by calendar.
 *
 * Subtracting years alone is wrong for anyone whose birthday has not yet come
 * round this year — which is, on average, half of everybody.
 */
export function yearsBetween(from: ParsedDate, to: ParsedDate): number {
  let age = to.y - from.y;
  if (to.m < from.m || (to.m === from.m && to.d < from.d)) age -= 1;
  return age;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "30 July 1970" — spelled out, unambiguous in every locale, no zone bugs. */
export function formatLongDate(p: ParsedDate): string {
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** `<time dateTime>` wants the ISO form back. */
export function toIso(p: ParsedDate): string {
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export type PersonLife = {
  born: { iso: string; label: string } | null;
  died: { iso: string; label: string } | null;
  /** Current age. Only ever set for someone living. */
  age: number | null;
  /** Age when they died. Only ever set for someone who has. */
  ageAtDeath: number | null;
  place: string | null;
  /** False when every one of the above is missing — the caller renders nothing. */
  hasAnything: boolean;
};

/**
 * The four states a person's vitals can be in, resolved once.
 *
 * living with a birthday · deceased · deceased with no birthday on file ·
 * nothing known at all. The last is the common case: across a 218-person
 * sample only 18% carry a biography, and the long tail of crew members
 * routinely has no dates at all.
 *
 * `now` is injectable so this stays a pure function — a component that reads
 * the clock cannot be checked, and an age that changes between the server
 * render and the client hydration is a mismatch.
 */
export function personLife(
  person: { birthday?: string | null; deathday?: string | null; place_of_birth?: string | null },
  now: ParsedDate = todayParts(),
): PersonLife {
  const b = parseTmdbDate(person.birthday);
  const d = parseTmdbDate(person.deathday);
  const place = typeof person.place_of_birth === "string" && person.place_of_birth.trim()
    ? person.place_of_birth.trim()
    : null;

  let age: number | null = null;
  let ageAtDeath: number | null = null;

  if (b && d) {
    const n = yearsBetween(b, d);
    // Guards against real bad rows: a death before a birth, or an implausible
    // span, means one of the two dates is wrong. Better to show the dates and
    // no age than to print "-4" or "212" beside someone's name.
    if (n >= 0 && n <= 122) ageAtDeath = n;
  } else if (b && !d) {
    const n = yearsBetween(b, now);
    if (n >= 0 && n <= 122) age = n;
  }

  return {
    born: b ? { iso: toIso(b), label: formatLongDate(b) } : null,
    died: d ? { iso: toIso(d), label: formatLongDate(d) } : null,
    age,
    ageAtDeath,
    place,
    hasAnything: Boolean(b || d || place),
  };
}

function todayParts(): ParsedDate {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

/**
 * The date a credit belongs to.
 *
 * Films carry `release_date`; TV carries `first_air_date`. Sorting a mixed
 * filmography on either alone silently buckets the other medium under
 * "Unknown".
 */
export function creditDate(c: { release_date?: string; first_air_date?: string }): string {
  return c.release_date || c.first_air_date || "";
}

/** Four-digit year, or null. String slice, not Date() — see the note up top. */
export function creditYear(c: { release_date?: string; first_air_date?: string }): number | null {
  const y = Number(creditDate(c).slice(0, 4));
  return y >= 1870 && y <= 2100 ? y : null;
}
