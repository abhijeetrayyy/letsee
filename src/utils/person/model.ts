/**
 * One row per title, from TMDB's one row per credit.
 *
 * `combined_credits` is credit-shaped, not title-shaped. A film someone
 * directed, wrote and produced arrives as three rows that render as three
 * identical cards; an actor credited twice on one series arrives twice and
 * gives React duplicate keys. Everything downstream — the ranking, the year
 * grouping, the collaborator seeds — wants titles.
 */

import { classifyCast, creditFlags, COURTESY_JOBS, type Bucket, type CastLike } from "./classify";
import { creditDate, creditYear } from "./dates";

export type RawCast = CastLike & {
  id: number;
  media_type?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  order?: number;
  adult?: boolean;
};

export type RawCrew = {
  id: number;
  media_type?: string;
  name?: string;
  title?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  job?: string;
  department?: string;
  episode_count?: number;
  genre_ids?: number[];
  adult?: boolean;
};

export type Credit = {
  key: string;
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  date: string;
  year: number | null;
  voteAverage: number;
  voteCount: number;
  /** Acting rows only. */
  characters: string[];
  order: number | null;
  episodeCount: number;
  /** Crew rows only. */
  jobs: string[];
  /**
   * A Set, not a scalar.
   *
   * Merging on (media_type, id) collapses Nolan's Inception — Director,
   * Writer, Producer — into one row, and whichever department landed first
   * won. Filtering that scalar against his known_for_department dropped
   * Inception from his own page entirely. A title belongs to every department
   * he worked in on it.
   */
  departments: string[];
  bucket: Bucket;
  isCrew: boolean;
  flags: { voice: boolean; uncredited: boolean; video: boolean };
};

const BUCKET_RANK: Record<Bucket, number> = {
  performance: 0,
  presenting: 1,
  appearance: 2,
  archive: 3,
};

function mediaTypeOf(r: { media_type?: string }): "movie" | "tv" | null {
  return r.media_type === "movie" || r.media_type === "tv" ? r.media_type : null;
}

function titleOf(r: { title?: string; name?: string }): string {
  return (r.title || r.name || "").trim();
}

/**
 * Build the title-level model.
 *
 * Acting and crew rows are merged into one map so a person who both acted in
 * and directed a film gets one card naming both, rather than the same poster
 * twice in two sections.
 */
export function buildCredits(cast: RawCast[] = [], crew: RawCrew[] = []): Credit[] {
  const byTitle = new Map<string, Credit>();

  const base = (r: RawCast | RawCrew, mt: "movie" | "tv", key: string): Credit => ({
    key,
    id: r.id,
    mediaType: mt,
    title: titleOf(r),
    posterPath: r.poster_path ?? null,
    date: creditDate(r),
    year: creditYear(r),
    voteAverage: r.vote_average ?? 0,
    voteCount: r.vote_count ?? 0,
    characters: [],
    order: null,
    episodeCount: 0,
    jobs: [],
    departments: [],
    bucket: "performance",
    isCrew: false,
    flags: { voice: false, uncredited: false, video: false },
  });

  for (const r of cast) {
    const mt = mediaTypeOf(r);
    if (!mt || !r.id || r.adult || !titleOf(r)) continue;
    const key = `${mt}-${r.id}`;
    const bucket = classifyCast(r);
    const flags = creditFlags(r);

    const prev = byTitle.get(key);
    if (!prev) {
      const c = base(r, mt, key);
      c.bucket = bucket;
      c.flags = flags;
      if (r.character?.trim()) c.characters.push(r.character.trim());
      if (typeof r.order === "number") c.order = r.order;
      c.episodeCount = r.episode_count ?? 0;
      byTitle.set(key, c);
      continue;
    }
    // Two credits on one title: keep the most substantial reading of both.
    if (BUCKET_RANK[bucket] < BUCKET_RANK[prev.bucket]) prev.bucket = bucket;
    if (r.character?.trim() && !prev.characters.includes(r.character.trim())) {
      prev.characters.push(r.character.trim());
    }
    if (typeof r.order === "number") prev.order = prev.order == null ? r.order : Math.min(prev.order, r.order);
    // Episode counts across two characters on one series genuinely add up.
    prev.episodeCount += r.episode_count ?? 0;
    prev.flags = {
      voice: prev.flags.voice || flags.voice,
      uncredited: prev.flags.uncredited && flags.uncredited,
      video: prev.flags.video || flags.video,
    };
  }

  for (const r of crew) {
    const mt = mediaTypeOf(r);
    if (!mt || !r.id || r.adult || !titleOf(r)) continue;
    if (r.job && COURTESY_JOBS.has(r.job)) continue;
    const key = `${mt}-${r.id}`;

    let c = byTitle.get(key);
    if (!c) {
      c = base(r, mt, key);
      // A crew-only row has no character to classify; it is work by definition.
      c.bucket = "performance";
      byTitle.set(key, c);
    }
    c.isCrew = true;
    if (r.job && !c.jobs.includes(r.job)) c.jobs.push(r.job);
    if (r.department && !c.departments.includes(r.department)) c.departments.push(r.department);
    if (!c.episodeCount && r.episode_count) c.episodeCount = r.episode_count;
  }

  return [...byTitle.values()];
}

/** Newest first, with undated credits last rather than sorted as year 0. */
export function byDateDesc(a: Credit, b: Credit): number {
  if (!a.date && !b.date) return b.voteCount - a.voteCount;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return b.date.localeCompare(a.date);
}

/** Credits not yet out — TMDB keeps future dates, and they belong up top. */
export function isUpcoming(c: Credit, todayIso: string): boolean {
  return Boolean(c.date) && c.date > todayIso;
}

/**
 * Roles played more than once across distinct titles.
 *
 * Two guards, both found by measuring: drop the character that equals the
 * person's own name (fictionalised-self cameos — Tom Hanks has five, Will
 * Smith six), and drop bare job words, because Morgan Freeman is "Narrator"
 * nine times and that is a job, not a recurring role.
 */
const GENERIC_ROLE = /^(narrator|self|host|voice|announcer|interviewer)\b/i;

export function recurringRoles(credits: Credit[], personName: string) {
  const norm = (s: string) => s.toLowerCase().replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const own = norm(personName);
  const map = new Map<string, { label: string; titles: Credit[] }>();

  for (const c of credits) {
    if (c.bucket !== "performance") continue;
    for (const raw of c.characters) {
      const n = norm(raw);
      if (!n || n === own || GENERIC_ROLE.test(n)) continue;
      const e = map.get(n) ?? { label: raw.replace(/\s*\(.*?\)\s*/g, " ").trim(), titles: [] };
      if (!e.titles.some((t) => t.key === c.key)) e.titles.push(c);
      map.set(n, e);
    }
  }

  return [...map.values()]
    .filter((e) => e.titles.length >= 3)
    .map((e) => {
      const years = e.titles.map((t) => t.year).filter((y): y is number => y != null);
      return {
        label: e.label,
        count: e.titles.length,
        from: years.length ? Math.min(...years) : null,
        to: years.length ? Math.max(...years) : null,
        titles: e.titles.slice().sort(byDateDesc),
      };
    })
    .sort((a, b) => b.count - a.count);
}
