/**
 * Turning "Amélie, 2001" into a TMDB id.
 *
 * This is the hard part of importing, not the parsing. The export carries no
 * TMDB id — only the title the user saw and a release year — so every film has
 * to be matched by name, and the cost of being wrong is asymmetric:
 *
 *   A missed match is a row the user fixes in one tap.
 *   A WRONG match is a film in their history they never saw, and they may never
 *   notice it's there.
 *
 * So this is deliberately conservative. Anything it isn't confident about comes
 * back `unresolved` for a human, and there is no "closest guess" fallback.
 */

import { distance } from "fastest-levenshtein";
import { fetchTmdbJson, tmdbConfigured } from "@/utils/tmdbClient";

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Edit distance tolerated on an otherwise-normalised title. */
const MAX_EDITS = 2;
/**
 * Years may disagree by one without meaning a different film: Letterboxd tends
 * to use the earliest festival showing, TMDB the primary release.
 */
const YEAR_SLACK = 1;

export type ResolvedTitle = {
  tmdbId: string;
  tmdbType: "movie" | "tv";
  matchedTitle: string;
  posterPath: string | null;
  releaseYear: number | null;
  genres: string[];
  runtime: number | null;
  /** How we got here, for debugging a bad import. Not shown to users. */
  via: "exact" | "fuzzy" | "sole-result" | "external-id" | "tmdb-id";
};

export type ResolveOutcome =
  | { status: "resolved"; match: ResolvedTitle }
  | { status: "unresolved"; candidates: ResolvedTitle[] };

type TmdbSearchResult = {
  id: number;
  title?: string;
  original_title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
};

/**
 * Strip everything that varies between two spellings of the same film without
 * changing which film it is: case, accents, punctuation, and the articles that
 * localised titles move around.
 *
 * Articles are removed from the *front* only. "The Thing" and "Thing" are
 * different films, but the year check is what separates them — dropping a
 * leading article is what makes "Amelie" match "Amélie" and "Le Fabuleux
 * Destin d'Amélie Poulain" fail honestly rather than half-matching.
 */
export function normalizeTitle(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining accents, split out by NFKD
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function yearOf(result: TmdbSearchResult): number | null {
  const date = result.release_date ?? result.first_air_date ?? "";
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) && year > 1870 ? year : null;
}

/**
 * Token-set overlap (Jaccard) between two normalised titles.
 *
 * Word *order* is what article-moving changes — "Good, Bad and Ugly, The"
 * against "The Good, the Bad and the Ugly" is a set-identical pair and a
 * disaster for edit distance. Word *membership* is what a different film
 * changes: "Avengers Infinity War" and "Avengers Endgame" share one token of
 * three. So comparing sets tolerates exactly the distortion we want to forgive
 * and catches exactly the one we must not.
 */
function tokenOverlap(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared += 1;
  return shared / (A.size + B.size - shared);
}

/** Below this, a sole result is a different film that merely contains the query. */
const MIN_SOLE_RESULT_OVERLAP = 0.6;

function yearsAgree(a: number | null, b: number | null): boolean {
  // No year on either side is not agreement — it's absence of evidence, and
  // the title alone is not enough to accept a match.
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= YEAR_SLACK;
}

function toResolved(
  result: TmdbSearchResult,
  genreNameById: Map<number, string>,
  via: ResolvedTitle["via"],
  tmdbType: "movie" | "tv" = "movie",
): ResolvedTitle {
  return {
    tmdbId: String(result.id),
    tmdbType,
    matchedTitle: result.title ?? result.name ?? "",
    posterPath: result.poster_path ?? null,
    releaseYear: yearOf(result),
    genres: (result.genre_ids ?? [])
      .map((id) => genreNameById.get(id))
      .filter((n): n is string => !!n),
    runtime: null,
    via,
  };
}

/**
 * Resolve one title by name.
 *
 * Films by default: Letterboxd is films-only, and searching the movie index
 * rather than multi avoids matching a title against a same-named series.
 * A source that knows it holds a series passes `mediaHint: "tv"`.
 */
export async function resolveTitle(
  title: string,
  year: number | null,
  genreNameById: Map<number, string>,
  /**
   * `tv` searches the series index; anything else keeps the films-only
   * behaviour Letterboxd needs. A source that knows it is describing a series
   * (Trakt, Simkl, TV Time, a "Show: Season 2: …" Netflix row) says so.
   */
  mediaHint: "movie" | "tv" | null = null,
): Promise<ResolveOutcome> {
  if (!tmdbConfigured()) return { status: "unresolved", candidates: [] };
  const tmdbType: "movie" | "tv" = mediaHint === "tv" ? "tv" : "movie";

  const params = new URLSearchParams({
    query: title,
    include_adult: "false",
    language: "en-US",
  });
  // Passing the year narrows TMDB's own ranking; we still verify it ourselves
  // below, because TMDB treats it as a hint rather than a filter.
  if (year) params.set(tmdbType === "tv" ? "first_air_date_year" : "year", String(year));

  let results: TmdbSearchResult[] = [];
  try {
    const data = await fetchTmdbJson<{ results?: TmdbSearchResult[] }>(
      `${TMDB_BASE}/search/${tmdbType}?${params.toString()}`,
      { timeoutMs: 8000 },
    );
    results = (data.results ?? []).slice(0, 10);
  } catch (err) {
    console.error(`resolveTitle "${title}":`, err);
    return { status: "unresolved", candidates: [] };
  }

  /**
   * A series export usually has no year at all, and a show's name is far
   * more often unique than a film's. So for series, an exact normalised name
   * match on the top result is accepted without a year — and nothing else is.
   */
  if (tmdbType === "tv" && year === null && results.length > 0) {
    const wantedName = normalizeTitle(title);
    const top = results[0];
    const names = [top.name, top.original_title, top.title].filter((t): t is string => !!t).map(normalizeTitle);
    const others = results.slice(1).filter((r) => [r.name, r.title].filter(Boolean).map((t) => normalizeTitle(t as string)).includes(wantedName));
    if (names.includes(wantedName) && others.length === 0) {
      return { status: "resolved", match: toResolved(top, genreNameById, "exact", "tv") };
    }
  }

  if (results.length === 0) return { status: "unresolved", candidates: [] };

  const wanted = normalizeTitle(title);

  // 1. Exact on the normalised localised OR original title, with the year
  //    agreeing. The original-title check is what catches films logged under
  //    their native name.
  for (const result of results) {
    const candidates = [result.title, result.original_title, result.name]
      .filter((t): t is string => !!t)
      .map(normalizeTitle);
    if (candidates.includes(wanted) && yearsAgree(year, yearOf(result))) {
      return { status: "resolved", match: toResolved(result, genreNameById, "exact", tmdbType) };
    }
  }

  // 2. Near-exact: typos and transliteration drift, still requiring the year.
  for (const result of results) {
    const candidates = [result.title, result.original_title, result.name]
      .filter((t): t is string => !!t)
      .map(normalizeTitle);
    const closest = Math.min(...candidates.map((c) => distance(c, wanted)));
    // Scale the tolerance down for short titles, where two edits can turn one
    // real film into a different real film ("Up" / "Us").
    const allowed = Math.min(MAX_EDITS, Math.floor(wanted.length / 4));
    if (closest <= allowed && yearsAgree(year, yearOf(result))) {
      return { status: "resolved", match: toResolved(result, genreNameById, "fuzzy", tmdbType) };
    }
  }

  /**
   * 3. A single result from the right year, *and* whose title is actually the
   *    same title.
   *
   * The original rule accepted any sole result on the reasoning that TMDB
   * "knows of exactly one film by roughly this name from that year". That
   * reasoning is wrong: `year=` **filters** the search, so one result means one
   * film from that year loosely matching — not an unambiguous one. A 500-film
   * run found five wrong matches through this branch alone, every one of them
   * a real film the user never watched:
   *
   *   "Spider-Man" (2003)             -> Daredevil vs. Spider-Man
   *   "Avengers: Infinity War" (2019) -> Avengers: Endgame
   *   "Zootopia" (2017)               -> Return to Zootopia
   *   "Ghost Rider" (2008)            -> Ghost Rider 5 Back To Basics
   *
   * Each is the query embedded in a longer, different title. Token overlap
   * rejects all four while still accepting the reordering this branch exists
   * for — "Good, Bad and Ugly, The" is set-identical to TMDB's phrasing.
   */
  if (results.length === 1 && year !== null && yearOf(results[0]) === year) {
    const sole = results[0];
    const best = Math.max(
      ...[sole.title, sole.original_title, sole.name]
        .filter((t): t is string => !!t)
        .map((t) => tokenOverlap(normalizeTitle(t), wanted)),
    );
    if (best >= MIN_SOLE_RESULT_OVERLAP) {
      return { status: "resolved", match: toResolved(sole, genreNameById, "sole-result", tmdbType) };
    }
  }

  // Otherwise hand the top few back as suggestions for a one-tap manual match.
  return {
    status: "unresolved",
    candidates: results.slice(0, 5).map((r) => toResolved(r, genreNameById, "sole-result", tmdbType)),
  };
}

// ── Ids: the exact path ─────────────────────────────────────────────────────

type TmdbDetail = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genres?: { id: number; name: string }[];
  runtime?: number | null;
};

function fromDetail(d: TmdbDetail, tmdbType: "movie" | "tv", via: ResolvedTitle["via"]): ResolvedTitle {
  const year = Number((d.release_date ?? d.first_air_date ?? "").slice(0, 4));
  return {
    tmdbId: String(d.id),
    tmdbType,
    matchedTitle: d.title ?? d.name ?? "",
    posterPath: d.poster_path ?? null,
    releaseYear: Number.isInteger(year) && year > 1870 ? year : null,
    genres: (d.genres ?? []).map((g) => g.name),
    runtime: d.runtime ?? null,
    via,
  };
}

/** A TMDB id the export already carried. One fetch, no guessing. */
export async function resolveByTmdbId(
  tmdbId: string,
  tmdbType: "movie" | "tv",
): Promise<ResolvedTitle | null> {
  if (!tmdbConfigured() || !/^\d+$/.test(tmdbId)) return null;
  try {
    const d = await fetchTmdbJson<TmdbDetail>(
      `${TMDB_BASE}/${tmdbType}/${tmdbId}?language=en-US`,
      { timeoutMs: 8000 },
    );
    return d?.id ? fromDetail(d, tmdbType, "tmdb-id") : null;
  } catch {
    return null;
  }
}

type FindResponse = {
  movie_results?: TmdbSearchResult[];
  tv_results?: TmdbSearchResult[];
};

/**
 * An IMDb or TheTVDB id, through TMDB's /find. This is the bridge every
 * other export needs: Trakt and Simkl carry IMDb ids, TV Time is keyed on
 * TheTVDB, IMDb's own export is nothing but `Const`.
 */
export async function resolveByExternalId(
  ids: { imdbId?: string | null; tvdbId?: string | null },
  genreNameById: Map<number, string>,
  mediaHint: "movie" | "tv" | null,
): Promise<ResolvedTitle | null> {
  if (!tmdbConfigured()) return null;
  const attempts: [string, string][] = [];
  if (ids.imdbId && /^tt\d+$/.test(ids.imdbId)) attempts.push([ids.imdbId, "imdb_id"]);
  if (ids.tvdbId && /^\d+$/.test(ids.tvdbId)) attempts.push([ids.tvdbId, "tvdb_id"]);

  for (const [id, source] of attempts) {
    try {
      const found = await fetchTmdbJson<FindResponse>(
        `${TMDB_BASE}/find/${encodeURIComponent(id)}?external_source=${source}`,
        { timeoutMs: 8000 },
      );
      const movie = found.movie_results?.[0];
      const tv = found.tv_results?.[0];
      if (mediaHint === "tv" && tv) return toResolved(tv, genreNameById, "external-id", "tv");
      if (mediaHint === "movie" && movie) return toResolved(movie, genreNameById, "external-id", "movie");
      if (movie) return toResolved(movie, genreNameById, "external-id", "movie");
      if (tv) return toResolved(tv, genreNameById, "external-id", "tv");
    } catch {
      // Try the next id; a miss here falls through to the name search.
    }
  }
  return null;
}

/**
 * Netflix knows the episode's name, not its number. One season fetch maps
 * names to numbers; unmatched names are dropped rather than guessed.
 */
export async function resolveEpisodeNumbers(
  showId: string,
  seasonNumber: number,
  names: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!tmdbConfigured() || names.length === 0) return out;
  try {
    const season = await fetchTmdbJson<{ episodes?: { episode_number: number; name?: string }[] }>(
      `${TMDB_BASE}/tv/${showId}/season/${seasonNumber}?language=en-US`,
      { timeoutMs: 8000 },
    );
    const episodes = (season.episodes ?? []).map((e) => ({ n: e.episode_number, name: normalizeTitle(e.name ?? "") }));
    for (const raw of names) {
      const wanted = normalizeTitle(raw);
      if (!wanted) continue;
      const exact = episodes.find((e) => e.name === wanted);
      if (exact) {
        out.set(raw, exact.n);
        continue;
      }
      const allowed = Math.min(MAX_EDITS, Math.floor(wanted.length / 4));
      const close = episodes
        .map((e) => ({ e, d: distance(e.name, wanted) }))
        .filter((x) => x.d <= allowed)
        .sort((a, b) => a.d - b.d)[0];
      if (close) out.set(raw, close.e.n);
    }
  } catch {
    // No season: nothing resolves, nothing is guessed.
  }
  return out;
}
