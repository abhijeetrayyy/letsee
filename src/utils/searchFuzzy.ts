/**
 * Fuzzy search helpers: re-rank TMDB results by typo tolerance, and "Did you mean?" from recent searches.
 * Uses Fuse.js (fuzzy match) and fastest-levenshtein (edit distance) — no paid APIs.
 */

import Fuse from "fuse.js";
import { distance } from "fastest-levenshtein";

export type SearchResultItem = {
  id: number;
  media_type: "movie" | "tv" | "person" | "keyword";
  title?: string;
  name?: string;
  poster_path?: string;
  profile_path?: string;
};

/**
 * Re-rank search results by fuzzy similarity to the query so typos still surface the right title.
 * Uses Fuse.js with threshold 1 so all items are returned, sorted by best match first.
 */
export function reRankSearchResults<T extends SearchResultItem>(
  categoryResults: T[],
  query: string
): T[] {
  if (!query.trim() || categoryResults.length === 0) return categoryResults;

  const fuse = new Fuse(categoryResults, {
    keys: ["title", "name"],
    threshold: 1,
    shouldSort: true,
    includeScore: true,
    ignoreLocation: true,
  });

  const searched = fuse.search(query);
  return searched.map((r) => r.item);
}

export type SearchResultsByCategory = {
  movie: SearchResultItem[];
  tv: SearchResultItem[];
  person: SearchResultItem[];
  keyword: SearchResultItem[];
};

/**
 * Re-rank all categories (movie, tv, person, keyword) by fuzzy match to query.
 */
export function reRankAll(
  results: SearchResultsByCategory,
  query: string
): SearchResultsByCategory {
  return {
    movie: reRankSearchResults(results.movie, query),
    tv: reRankSearchResults(results.tv, query),
    person: reRankSearchResults(results.person, query),
    keyword: reRankSearchResults(results.keyword, query),
  };
}

/** Minimum similarity (0–1) to suggest "Did you mean?" — avoid suggesting when query is exact or very different. */
const DID_YOU_MEAN_MIN_SIMILARITY = 0.72;
/** Max edit distance ratio to suggest (e.g. 0.35 = allow ~35% of length as edits). */
const DID_YOU_MEAN_MAX_DISTANCE_RATIO = 0.35;

/**
 * From a list of candidate strings (e.g. recent searches), return the best "Did you mean?" suggestion
 * if the query is not exact but is close enough to one candidate. Returns null if no good suggestion.
 */
export function getDidYouMeanSuggestion(
  query: string,
  candidates: string[]
): string | null {
  const q = query.trim().toLowerCase();
  if (q.length < 2 || candidates.length === 0) return null;

  const normalized = candidates.map((c) => c.trim()).filter((c) => c.length >= 2);
  if (normalized.length === 0) return null;

  let best: { candidate: string; dist: number } | null = null;

  for (const candidate of normalized) {
    const cLower = candidate.toLowerCase();
    if (cLower === q) return null; // exact match, no suggestion needed

    const d = distance(q, cLower);
    const maxLen = Math.max(q.length, cLower.length);
    const ratio = d / maxLen;
    const similarity = 1 - d / maxLen;

    // Suggest only if similar enough and not too many edits
    if (
      similarity >= DID_YOU_MEAN_MIN_SIMILARITY &&
      ratio <= DID_YOU_MEAN_MAX_DISTANCE_RATIO
    ) {
      if (!best || d < best.dist) best = { candidate, dist: d };
    }
  }

  return best ? best.candidate : null;
}
