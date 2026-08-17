"use client";

import { useEffect, useMemo, useState } from "react";
import { useCountry } from "@/app/contextAPI/countryContext";
import { Section } from "@components/detail/TitleChrome";
import { Countrydata } from "@/staticData/countryName";
import { parseTmdbDate, formatLongDate, toIso, type ParsedDate } from "@/utils/person/dates";

/**
 * When you can actually watch this at home.
 *
 * `release_dates` is fetched in full on every movie page and everything except
 * a single certification string is thrown away. What gets discarded is the
 * dated release TYPES — premiere, limited, theatrical, digital, physical, TV —
 * and the digital one is the answer to the question people are really asking
 * when they look up a film that is still in cinemas.
 *
 * WHY THIS FALLS BACK RATHER THAN INSISTING ON THE LOCAL REGION. Measured live
 * across seventeen films, half of them Indian:
 *
 *   IN has a digital date      4/17 (24%)
 *   US has a digital date     13/17 (76%)
 *   IN has any theatrical date 9/17 (53%)
 *   ANY country has a digital 15/17 (88%)
 *
 * A rail keyed strictly on the reader's own region would therefore be empty
 * three times out of four for an Indian reader — and eight of those seventeen
 * films carry no IN row of any kind. RRR has no release_dates entries for any
 * country at all; Laapataa Ladies has twelve countries and neither IN nor US
 * among them. So the rule is: take the region's own date when it exists, take
 * someone else's when it does not, and never let the second pass for the
 * first. Every borrowed date wears the country it came from, following the
 * same rule the certification chip already lives by.
 *
 * The rail degrades one row at a time instead of all at once. A film with only
 * a theatrical date shows a theatrical date. A film with nothing dated
 * anywhere renders nothing — the 2-in-17 case.
 */

/** TMDB's release type enum. Physical and TV are kept; premiere is not — see below. */
const PREMIERE = 1;
const LIMITED = 2;
const THEATRICAL = 3;
const DIGITAL = 4;
const PHYSICAL = 5;
const TV = 6;

/** Ordered after the reader's own region: large markets that actually carry digital rows. */
const FALLBACKS = ["US", "GB", "CA", "AU"];

type RawEntry = { certification?: string; note?: string; release_date?: string; type?: number };
type RawCountry = { iso_3166_1?: string; release_dates?: RawEntry[] };

type Dated = { date: ParsedDate; note: string | null; country: string };

type Row = {
  key: string;
  label: string;
  /** What this date means for the reader, in the second line. */
  hint: string;
  date: ParsedDate;
  note: string | null;
  country: string;
  isLocal: boolean;
  /** Digital is the row the section exists for; it gets the emphasis. */
  primary: boolean;
};

function countryName(code: string): string {
  return Countrydata.find((c) => c.iso_3166_1 === code)?.english_name ?? code;
}

function todayParts(): ParsedDate {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

/**
 * Whole days between two dates, by explicit UTC arithmetic on the parsed parts.
 * Never `new Date(string)` — TMDB hands these back as `2023-07-21T00:00:00.000Z`
 * and reading that in a negative-offset timezone lands on the 20th.
 */
function dayGap(from: ParsedDate, to: ParsedDate): number {
  const a = Date.UTC(from.y, from.m - 1, from.d);
  const b = Date.UTC(to.y, to.m - 1, to.d);
  return Math.round((b - a) / 86_400_000);
}

/** Earliest dated entry of each type, per country. Notes ride along — TMDB puts the platform there ("Peacock", "70mm IMAX"). */
function indexByCountry(results: RawCountry[]): Map<string, Map<number, Dated>> {
  const out = new Map<string, Map<number, Dated>>();
  for (const c of results ?? []) {
    const code = c.iso_3166_1;
    if (!code) continue;
    const byType = new Map<number, Dated>();
    for (const e of c.release_dates ?? []) {
      const t = e.type;
      const d = parseTmdbDate(e.release_date);
      if (!t || !d) continue;
      const prev = byType.get(t);
      // A type can repeat: Oppenheimer carries two US digital rows, a 2023
      // storefront release and a 2024 Peacock one. The earliest is the honest
      // answer to "since when could I watch this at home".
      if (!prev || toIso(d) < toIso(prev.date)) {
        const note = e.note?.trim();
        byType.set(t, { date: d, note: note || null, country: code });
      }
    }
    if (byType.size) out.set(code, byType);
  }
  return out;
}

/**
 * The reader's own region first, then large markets, then anywhere at all.
 *
 * `borrow` is off for the rows that are only meaningful at home. Allowing every
 * row to fall back filled the rail with dates like "On TV — 2 August 2026 (AR)"
 * on Oppenheimer and "(SK)" on Rocketry: an Argentine broadcast slot is not an
 * answer to any question an Indian reader has, and four rows of it made the
 * section look substantial while saying nothing. Cinema and digital carry the
 * section, so only they are worth reaching abroad for.
 */
function pick(
  index: Map<string, Map<number, Dated>>,
  types: number[],
  region: string,
  borrow: boolean,
): Dated | null {
  const from = (code: string): Dated | null => {
    const byType = index.get(code);
    if (!byType) return null;
    for (const t of types) {
      const hit = byType.get(t);
      if (hit) return hit;
    }
    return null;
  };

  const local = from(region);
  if (local || !borrow) return local;

  for (const code of FALLBACKS) {
    if (code === region) continue;
    const hit = from(code);
    if (hit) return hit;
  }
  for (const code of index.keys()) {
    const hit = from(code);
    if (hit) return hit;
  }
  return null;
}

export function buildRows(results: RawCountry[], region: string): Row[] {
  const index = indexByCountry(results);
  if (index.size === 0) return [];

  const spec: {
    key: string;
    label: string;
    hint: string;
    types: number[];
    borrow: boolean;
    primary?: boolean;
  }[] = [
    // Limited stands in for theatrical only when there was no wide run, which
    // is the normal shape for a festival-circuit film.
    { key: "cinema", label: "In cinemas", hint: "Theatrical release", types: [THEATRICAL, LIMITED], borrow: true },
    { key: "digital", label: "At home", hint: "Digital — buy, rent or stream", types: [DIGITAL], borrow: true, primary: true },
    { key: "physical", label: "On disc", hint: "Blu-ray or DVD", types: [PHYSICAL], borrow: false },
    { key: "tv", label: "On TV", hint: "Broadcast", types: [TV], borrow: false },
  ];

  const rows: Row[] = [];
  for (const s of spec) {
    const hit = pick(index, s.types, region, s.borrow);
    if (!hit) continue;
    rows.push({
      key: s.key,
      label: s.label,
      hint: s.hint,
      date: hit.date,
      note: hit.note,
      country: hit.country,
      isLocal: hit.country === region,
      primary: Boolean(s.primary),
    });
  }

  /**
   * Chronological, not in the fixed order above. Borrowed dates routinely
   * predate local ones — Parasite reached US digital on 14 January 2020, two
   * weeks BEFORE it opened in Indian cinemas — and a rail that calls itself a
   * timeline while running backwards reads as a bug rather than as the genuine
   * fact that the two dates belong to two countries.
   */
  rows.sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)));

  // Premiere is festival noise and is normally the earliest date on the record,
  // so it would sit at the top of the rail implying a release that had not
  // happened. It earns a place only when it is the only thing on file.
  if (rows.length === 0) {
    const hit = pick(index, [PREMIERE], region, true);
    if (hit) {
      rows.push({
        key: "premiere",
        label: "Premiered",
        hint: "Festival or premiere screening",
        date: hit.date,
        note: hit.note,
        country: hit.country,
        isLocal: hit.country === region,
        primary: false,
      });
    }
  }

  return rows;
}

export default function ReleaseTimeline({
  releaseDates,
}: {
  /** `movie.release_dates.results` — already on the payload the page fetches. */
  releaseDates: RawCountry[] | undefined;
}) {
  const { country } = useCountry();
  const rows = useMemo(() => buildRows(releaseDates ?? [], country), [releaseDates, country]);

  /**
   * "In 12 days" is read from the clock, and a clock read during the server
   * render disagrees with the one read at hydration. Relative phrasing waits
   * until the component is mounted; the absolute date is there from the first
   * paint either way.
   */
  const [today, setToday] = useState<ParsedDate | null>(null);
  useEffect(() => setToday(todayParts()), []);

  if (rows.length === 0) return null;

  const digital = rows.find((r) => r.key === "digital") ?? null;
  const cinema = rows.find((r) => r.key === "cinema") ?? null;

  /**
   * The theatrical window, but only when both dates come from the same
   * country. An Indian cinema date measured against an American digital date
   * is not a window, it is a subtraction of two unrelated numbers.
   */
  const theatricalWindow =
    cinema && digital && cinema.country === digital.country
      ? dayGap(cinema.date, digital.date)
      : null;

  const borrowed = rows.filter((r) => !r.isLocal);
  const allBorrowed = borrowed.length === rows.length;

  return (
    <Section
      title="Release"
      subtitle={allBorrowed ? `No dates on file for ${countryName(country)}` : countryName(country)}
    >
      <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-4 sm:p-5">
        <ol className="relative space-y-4">
          {rows.map((r, i) => {
            const ahead = today ? dayGap(today, r.date) : null;
            const future = ahead !== null && ahead > 0;
            const dot = r.primary
              ? future
                ? "bg-accent-gold"
                : "bg-brand-500"
              : "bg-surface-600";

            return (
              <li key={r.key} className="relative flex gap-3 pl-1">
                {/* The connector stops at the last row rather than trailing off
                    below it into the padding. */}
                {i < rows.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[7px] top-4 h-full w-px bg-surface-800"
                  />
                )}
                <span
                  aria-hidden
                  className={`relative mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full ${dot}`}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={`text-sm ${r.primary ? "font-semibold text-white" : "text-surface-300"}`}
                    >
                      {r.label}
                    </span>
                    <time
                      dateTime={toIso(r.date)}
                      className="font-mono text-xs tabular-nums text-surface-400"
                    >
                      {formatLongDate(r.date)}
                    </time>
                    {!r.isLocal && (
                      <span
                        className="rounded-md bg-surface-800/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-surface-400"
                        title={`Date on file for ${countryName(r.country)}, not ${countryName(country)}`}
                      >
                        {r.country}
                      </span>
                    )}
                    {future && (
                      <span className="text-[11px] text-accent-gold">
                        in {ahead} day{ahead === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-surface-500">
                    {r.note ?? r.hint}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        {theatricalWindow !== null && theatricalWindow > 0 && (
          <p className="mt-4 border-t border-surface-800 pt-3 text-xs text-surface-500">
            <span className="font-mono tabular-nums text-surface-300">{theatricalWindow}</span>{" "}
            days in cinemas before it reached home.
          </p>
        )}
      </div>
    </Section>
  );
}
