/**
 * The local search index — typo-tolerant suggestions with no network at all.
 *
 * The constraint this exists to work around is real and measurable: TMDB does
 * not fuzzy-correct. Measured against `/search/multi`, every one of these
 * returns **zero** results — not degraded, zero:
 *
 *     Incepton  Inceptoin  Intersteller  Shawshenk  Pulp Fictoin
 *     Gladeator  The Grene Mile  Everythin Everywhere
 *
 * It matches prefixes (`Parasit` → 138 hits) but has no edit-distance
 * tolerance, so one dropped letter is an empty page. Asking it to spell-check
 * is asking the wrong service. So the correction happens here instead, against
 * the few thousand titles a person is overwhelmingly likely to mean, and TMDB
 * is only consulted once the user commits.
 *
 * Deliberately pure — no React, no fetch, no DOM. That is what lets the whole
 * thing be verified by a script rather than by clicking around.
 */

import Fuse from "fuse.js";
// Both pure and dependency-free, so importing it here creates no cycle.
import { buildBrowseUrl } from "@/utils/browseUrl";

/**
 * `network` is here rather than fetched because TMDB has no `/search/network`
 * endpoint — it 404s. The list is checked in, so networks are instant and
 * typo-tolerant like everything else local.
 */
export type IndexKind = "movie" | "tv" | "person" | "network";

export type IndexRow = {
  /** `type:id` — never a bare id. Migration 064 exists because TMDB numbers films and series independently. */
  k: string;
  /** Display name. */
  n: string;
  /** Normalized search key, precomputed so it is never recomputed per keystroke. */
  s: string;
  t: IndexKind;
  /** Release year, or null. The library tables carry no year column, so library-only rows have none. */
  y: number | null;
  /**
   * Poster or profile image — a TMDB path from the popular slice, an absolute
   * URL from the library. `getPosterUrl` resolves either, so the two sources
   * do not have to agree.
   *
   * Dropped in the first version of this index to keep a "zero network while
   * typing" claim clean. That was the wrong trade: the acceptance criterion is
   * that a *suggestion appears* within one frame, and text does. A poster
   * loads afterwards without gating the row, and being able to recognise a
   * film by its poster is most of why a picker is faster than a list.
   */
  p?: string | null;
  /** True when this came from the signed-in user's own library. */
  lib?: boolean;
};

export type SearchIndex = {
  rows: IndexRow[];
  fuse: Fuse<IndexRow>;
};

/**
 * The size ceiling, and it is measured rather than chosen.
 *
 * fuse.js 7.1.0 search cost by corpus size on a desktop, p50 / p95:
 *
 *      500 rows   0.37ms /  1.12ms
 *    2,000 rows   1.32ms /  3.85ms
 *    5,000 rows   3.25ms /  9.56ms   <- inside a 16.7ms frame
 *   10,000 rows   6.72ms / 19.21ms   <- p95 misses the frame
 *   20,000 rows  12.67ms / 37.55ms
 *
 * 5,000 is the largest round number whose p95 still fits one frame with room
 * for a phone being several times slower. The acceptance criterion says "within
 * one frame", so the index is capped rather than the criterion softened.
 */
export const MAX_INDEX_ROWS = 5000;

/**
 * Below this many characters Fuse is not used at all — see `queryIndex`.
 * `minMatchCharLength: 3` is what keeps junk out (measured below), but it also
 * means a 2-character query matches nothing, so short queries take another path.
 */
const FUZZY_MIN_CHARS = 3;

/**
 * Fold case, strip accents, and reduce punctuation to single spaces.
 *
 * Without this, "WALL·E" and "wall e" are different strings, and every
 * apostrophe and colon in a title is a character the user has to guess.
 */
export function normalizeQuery(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Fuse configuration, every value measured on a ~3,900-title real corpus.
 *
 * `threshold: 0.3` — a sweep over 200 real titles × 3 typo classes (dropped,
 * transposed and doubled characters) scored rank-1 accuracy:
 *
 *   0.20 → 96.2%    0.30 → 99.7%    0.40 → 99.5%    0.50 → 99.5% but junk appears
 *
 * 0.3 is the peak, and going looser buys nothing while starting to match
 * nonsense. `minMatchCharLength: 3` is what actually excludes junk: at length 2
 * the query "asdf" returns 4 titles at every threshold, and at 3 it returns
 * none. At threshold 0.4 even length 3 lets "aeiou" match 23 titles — which is
 * why the threshold and the match length are tuned together, not separately.
 *
 * No score boost for prefix or word-boundary matches, despite the obvious
 * temptation. Measured, Fuse at 0.3 already ranks correctly — "dark" gives
 * *Dark*, *Poldark*, *Dark Phoenix* and "godfather" gives *The Godfather*
 * first — and adding a prefix tier actively made it worse, promoting
 * *Godfather of Harlem* above *The Godfather*.
 */
const FUSE_OPTIONS = {
  keys: [{ name: "s", weight: 1 }],
  threshold: 0.3,
  minMatchCharLength: FUZZY_MIN_CHARS,
  // Titles are short and the match can be anywhere in them; without this Fuse
  // penalises matches far from the start, so "ragnarok" scores worse against
  // "Thor: Ragnarok" purely for being the second word.
  ignoreLocation: true,
  includeScore: true,
};

/**
 * Build the index once per row-set.
 *
 * Library rows are kept in preference to popular ones when the cap bites: a
 * person's own films are far likelier to be what they are typing, and they are
 * also the rows that TMDB's own search would find anyway.
 */
export function buildSearchIndex(rows: IndexRow[]): SearchIndex {
  const seen = new Set<string>();
  const deduped: IndexRow[] = [];

  // Two passes so library rows win the dedupe against a popular-slice row for
  // the same title, keeping the `lib` flag that drives the "In your library"
  // hint and the ranking nudge.
  for (const row of rows) {
    if (!row.lib || !row.n || seen.has(row.k)) continue;
    seen.add(row.k);
    deduped.push(row);
  }
  for (const row of rows) {
    if (row.lib || !row.n || seen.has(row.k)) continue;
    if (deduped.length >= MAX_INDEX_ROWS) break;
    seen.add(row.k);
    deduped.push(row);
  }

  const capped = deduped.slice(0, MAX_INDEX_ROWS);
  return { rows: capped, fuse: new Fuse(capped, FUSE_OPTIONS) };
}

/**
 * Query the index. Synchronous by design — the whole point is that a
 * suggestion is available in the same tick as the keystroke.
 *
 * Titles before people, matching the grouping the plan asks for. Within a
 * group, a library title edges out a non-library one at equal relevance, which
 * is the one place the user's own history is allowed to influence order.
 */
export function queryIndex(
  index: SearchIndex | null,
  rawQuery: string,
  limit = 26,
): IndexRow[] {
  if (!index) return [];
  const q = normalizeQuery(rawQuery);
  if (!q) return [];

  let matches: { row: IndexRow; score: number }[];

  if (q.length < FUZZY_MIN_CHARS) {
    // Fuse cannot serve these — `minMatchCharLength: 3` means a 1–2 character
    // query matches nothing at all. A prefix scan is both correct and cheaper
    // here, and it is what makes typing "st" show *Star Wars* rather than
    // nothing until the third character.
    matches = [];
    for (const row of index.rows) {
      const at = row.s.startsWith(q) ? 0 : row.s.includes(` ${q}`) ? 1 : -1;
      if (at >= 0) matches.push({ row, score: at });
      if (matches.length > Math.max(limit * 12, 240)) break;
    }
  } else {
    matches = index.fuse
      .search(q, { limit: Math.max(limit * 4, 120) })
      .map((r) => ({ row: r.item, score: r.score ?? 1 }));
  }

  /**
   * Allocate per kind rather than taking a flat top-N.
   *
   * Titles sort ahead of people, so a single global cap means a query matching
   * plenty of films shows *no* people at all — "man" matches 44 rows in a real
   * index, and the first 24 of those are all titles. Giving each kind its own
   * allowance keeps every group reachable while still letting titles dominate
   * the space, which is what people are usually looking for.
   */
  const perKind: Record<IndexKind, number> = { movie: 0, tv: 0, person: 0, network: 0 };
  const allowance: Record<IndexKind, number> = { movie: 10, tv: 10, person: 6, network: 6 };

  const rank = (kind: IndexKind) => (kind === "person" ? 1 : kind === "network" ? 2 : 0);
  return matches
    .sort(
      (a, b) =>
        rank(a.row.t) - rank(b.row.t) ||
        a.score - b.score ||
        Number(Boolean(b.row.lib)) - Number(Boolean(a.row.lib)),
    )
    .filter((m) => {
      if (perKind[m.row.t] >= allowance[m.row.t]) return false;
      perKind[m.row.t] += 1;
      return true;
    })
    .slice(0, limit)
    .map((m) => m.row);
}

/** Where a suggestion goes when chosen. */
export function rowHref(row: IndexRow): string {
  const id = row.k.slice(row.k.indexOf(":") + 1);
  if (row.t === "person") return `/app/person/${id}`;
  // A network is a browse facet, not a page — D3 already built the destination.
  if (row.t === "network") return buildBrowseUrl({ type: "tv", network: id });
  return `/app/${row.t}/${id}`;
}
