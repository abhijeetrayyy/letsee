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
import { fetchTmdbJson } from "@/utils/tmdbClient";

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
  via: "exact" | "fuzzy" | "sole-result";
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
): ResolvedTitle {
  return {
    tmdbId: String(result.id),
    tmdbType: "movie",
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
 * Resolve one film.
 *
 * Letterboxd is films-only, so this searches TMDB's movie index rather than
 * multi — which also avoids matching a title against a same-named TV series.
 */
export async function resolveTitle(
  title: string,
  year: number | null,
  genreNameById: Map<number, string>,
): Promise<ResolveOutcome> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return { status: "unresolved", candidates: [] };

  const params = new URLSearchParams({
    api_key: apiKey,
    query: title,
    include_adult: "false",
    language: "en-US",
  });
  // Passing the year narrows TMDB's own ranking; we still verify it ourselves
  // below, because TMDB treats it as a hint rather than a filter.
  if (year) params.set("year", String(year));

  let results: TmdbSearchResult[] = [];
  try {
    const data = await fetchTmdbJson<{ results?: TmdbSearchResult[] }>(
      `${TMDB_BASE}/search/movie?${params.toString()}`,
      { timeoutMs: 8000 },
    );
    results = (data.results ?? []).slice(0, 10);
  } catch (err) {
    console.error(`resolveTitle "${title}":`, err);
    return { status: "unresolved", candidates: [] };
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
      return { status: "resolved", match: toResolved(result, genreNameById, "exact") };
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
      return { status: "resolved", match: toResolved(result, genreNameById, "fuzzy") };
    }
  }

  // 3. A single result whose year matches exactly. Unambiguous by construction:
  //    TMDB knows of exactly one film by roughly this name from that year.
  if (results.length === 1 && year !== null && yearOf(results[0]) === year) {
    return { status: "resolved", match: toResolved(results[0], genreNameById, "sole-result") };
  }

  // Otherwise hand the top few back as suggestions for a one-tap manual match.
  return {
    status: "unresolved",
    candidates: results.slice(0, 5).map((r) => toResolved(r, genreNameById, "sole-result")),
  };
}
