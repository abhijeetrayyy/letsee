/**
 * Related titles, ranked by evidence rather than by the provider's guess.
 *
 * TMDB's `/recommendations` and `/similar` are both already fetched by the
 * detail pages and both shown, as two near-identical rails that say nothing
 * about why anything is in them. Measured against *Interstellar*, TMDB's own
 * ordering does not track subject overlap at all: its #1 result shares 3
 * keywords, its #3 shares 1, its #5 shares 4. There is real signal available
 * and TMDB is not using it.
 *
 * So rank on evidence we can name, and say the reason out loud:
 *
 *     shared keywords → same director → same collection → our own audience
 *
 * with TMDB's own ordering kept only as the tie-break of last resort.
 *
 * Pure and dependency-free on purpose — no fetch, no React, no `@/` imports —
 * so the whole ranking is verifiable by a script with no network and no
 * database. Everything that needs either lives in `relatedData.ts`.
 *
 * Follows `tonight.ts`: weighted terms, unknown terms renormalised away rather
 * than scored as zero, and **the reason is evidence, never a percentage**.
 */

export type MediaType = "movie" | "tv";

export type RelatedSeed = {
  id: number;
  mediaType: MediaType;
  title: string;
  keywordIds: number[];
  keywordNames: Map<number, string>;
  /** Directors for film, creators for series. */
  peopleIds: number[];
  peopleNames: Map<number, string>;
  collectionId: number | null;
  collectionName: string | null;
};

export type RelatedCandidate = {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  adult: boolean;
  genreIds: number[];
  voteAverage: number | null;
  voteCount: number | null;
  releaseDate: string | null;
  overview: string | null;
  /** Position in TMDB's own combined ordering, 0-based. The tie-break of last resort. */
  tmdbRank: number;
  poolSize: number;
};

export type RelatedEvidence = {
  /** Candidate id → its TMDB keyword ids. A missing key means *unknown*, not *none*. */
  keywordIds?: Map<number, number[]>;
  /** TMDB ids of everything the seed's director/creator also made. */
  filmographyIds?: Set<number>;
  /** TMDB ids in the seed's collection. */
  collectionPartIds?: Set<number>;
  /** From migration 066. Absent means the signal does not exist yet. */
  community?: {
    seedWatchers: number;
    byId: Map<number, number>;
  };
};

export type RelatedItem = RelatedCandidate & {
  score: number;
  reason: string;
};

/**
 * Priority order comes straight from the plan. The weights are spread rather
 * than equal because these signals are not equally informative: sharing four
 * keywords is a statement about what a film is *about*, while appearing in
 * TMDB's list is a statement about what its API returned.
 */
const WEIGHTS = {
  keywords: 0.4,
  director: 0.22,
  collection: 0.2,
  community: 0.14,
  tmdb: 0.04,
} as const;

type TermKey = keyof typeof WEIGHTS;

/**
 * Cap the denominator when counting keyword overlap.
 *
 * Keyword counts vary wildly — 29 on *Interstellar*, 14 on *Inception*, 6 on a
 * typical series. Dividing by the seed's own count would make a
 * richly-tagged film score every candidate near zero purely for being
 * well-documented, so overlap is measured against at most this many.
 */
const KEYWORD_DENOMINATOR = 6;

function keywordTerm(
  seed: RelatedSeed,
  candidate: RelatedCandidate,
  evidence: RelatedEvidence,
): { value: number | null; shared: number[] } {
  const theirs = evidence.keywordIds?.get(candidate.id);
  if (!theirs || seed.keywordIds.length === 0) return { value: null, shared: [] };
  const mine = new Set(seed.keywordIds);
  const shared = theirs.filter((k) => mine.has(k));
  const denominator = Math.min(seed.keywordIds.length, KEYWORD_DENOMINATOR);
  return { value: Math.min(1, shared.length / denominator), shared };
}

/**
 * Score one candidate, and remember which term earned it.
 *
 * Unknown terms are dropped and their weight redistributed across the rest,
 * the same handling `tonight.ts` uses for unknown quality. Without it, the
 * no-evidence render would score every candidate as having failed three tests
 * it was never given — and on a series page `collection` is *permanently*
 * unknown, so a fifth of the weight would be dead on every TV page forever.
 */
function scoreCandidate(
  seed: RelatedSeed,
  candidate: RelatedCandidate,
  evidence: RelatedEvidence,
) {
  const { value: keywords, shared } = keywordTerm(seed, candidate, evidence);

  const director = evidence.filmographyIds
    ? evidence.filmographyIds.has(candidate.id)
      ? 1
      : 0
    : null;

  // Null rather than 0 when the seed simply has no collection: "not in a
  // collection it doesn't have" is not evidence against a candidate.
  const collection =
    seed.collectionId == null || !evidence.collectionPartIds
      ? null
      : evidence.collectionPartIds.has(candidate.id)
        ? 1
        : 0;

  let community: number | null = null;
  let coWatchers = 0;
  if (evidence.community && evidence.community.seedWatchers > 0) {
    coWatchers = evidence.community.byId.get(candidate.id) ?? 0;
    // Shrunk toward zero, as 043 does for people: one co-watcher out of one
    // watcher is not a perfect signal, it is a coincidence with n=1.
    const share = coWatchers / evidence.community.seedWatchers;
    community = share * (coWatchers / (coWatchers + 2));
  }

  // Position in TMDB's own ordering, not vote count. Re-sorting by votes would
  // turn "related" into "popular" — measured, 83% of a recommendation list
  // clears any sane vote threshold, so a vote-count prior saturates and the
  // ranking silently becomes a popularity chart.
  const tmdb =
    candidate.poolSize > 1 ? 1 - candidate.tmdbRank / (candidate.poolSize - 1) : 1;

  const terms: Record<TermKey, number | null> = {
    keywords,
    director,
    collection,
    community,
    tmdb,
  };

  let sum = 0;
  let known = 0;
  for (const key of Object.keys(WEIGHTS) as TermKey[]) {
    const value = terms[key];
    if (value === null) continue;
    sum += WEIGHTS[key] * value;
    known += WEIGHTS[key];
  }

  return {
    score: known > 0 ? sum / known : 0,
    terms,
    shared,
    coWatchers,
  };
}

/** Priority order, used only to break ties between equal contributions. */
const TERM_PRIORITY: TermKey[] = ["keywords", "director", "collection", "community", "tmdb"];

/**
 * The term that actually earned the placing.
 *
 * Chosen by weighted *contribution*, not by priority order — and the
 * difference is not academic. Ranking *Inception* under *Interstellar*, the
 * priority-order version reported "Shares 1 theme with Interstellar, including
 * time travel" when what put it second was being another Nolan film: a single
 * incidental keyword masked the signal doing the work, and the card explained
 * itself with its weakest evidence. Whatever contributed most is what the
 * sentence should name.
 */
function leadingTerm(terms: Record<TermKey, number | null>): TermKey {
  let best: TermKey = "tmdb";
  let bestContribution = 0;

  for (const key of TERM_PRIORITY) {
    if (key === "tmdb") continue;
    const value = terms[key];
    if (value === null || value <= 0) continue;
    const contribution = WEIGHTS[key] * value;
    // Strictly greater, so priority order settles exact ties.
    if (contribution > bestContribution) {
      best = key;
      bestContribution = contribution;
    }
  }

  return best;
}

function list(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * One line, naming the evidence.
 *
 * `tonight.ts` states the rule this follows: "the reason is evidence, never a
 * percentage. 'You both watchlisted it' is a reason. '87% match' is noise
 * wearing a number." So these say what is shared, never how strongly.
 */
export function buildRelatedReason(
  seed: RelatedSeed,
  terms: Record<TermKey, number | null>,
  shared: number[],
  coWatchers: number,
  seedWatchers: number,
): string {
  switch (leadingTerm(terms)) {
    case "keywords": {
      const names = shared
        .map((id) => seed.keywordNames.get(id))
        .filter((n): n is string => Boolean(n))
        .slice(0, 2);
      const count = shared.length;
      const noun = count === 1 ? "theme" : "themes";
      return names.length > 0
        ? `Shares ${count} ${noun} with ${seed.title}, including ${list(names)}.`
        : `Shares ${count} ${noun} with ${seed.title}.`;
    }
    case "director": {
      const names = seed.peopleIds
        .map((id) => seed.peopleNames.get(id))
        .filter((n): n is string => Boolean(n))
        .slice(0, 2);
      const verb = seed.mediaType === "tv" ? "created by" : "directed by";
      return names.length > 0 ? `Also ${verb} ${list(names)}.` : `Same ${verb.split(" ")[1]}.`;
    }
    case "collection":
      return seed.collectionName
        ? `Part of the ${seed.collectionName}.`
        : `In the same collection as ${seed.title}.`;
    case "community":
      // A count, not a rate. "2 of the 7 people" is checkable; "29%" is not.
      return `Watched by ${coWatchers} of the ${seedWatchers} people here who saw ${seed.title}.`;
    default:
      return `TMDB lists this alongside ${seed.title}.`;
  }
}

/**
 * Rank a pool of candidates against a seed.
 *
 * Every candidate must carry the *same* evidence — enrich the whole pool or
 * none of it. Mixing enriched and unenriched candidates in one list would make
 * "we didn't check" outrank "we checked and it doesn't match", because an
 * unknown term is renormalised away while a known zero drags the score down.
 * The caller enforces this by ranking exactly the candidates it enriched.
 */
export function rankRelated(
  seed: RelatedSeed,
  pool: RelatedCandidate[],
  evidence: RelatedEvidence = {},
  limit = 12,
): RelatedItem[] {
  const seedWatchers = evidence.community?.seedWatchers ?? 0;

  return pool
    .filter((c) => c.id !== seed.id)
    .map((candidate) => {
      const { score, terms, shared, coWatchers } = scoreCandidate(seed, candidate, evidence);
      return {
        candidate,
        score,
        lead: TERM_PRIORITY.indexOf(leadingTerm(terms)),
        reason: buildRelatedReason(seed, terms, shared, coWatchers, seedWatchers),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        // A director match outranks a popularity-only match at equal score.
        a.lead - b.lead ||
        (b.candidate.voteCount ?? 0) - (a.candidate.voteCount ?? 0) ||
        // Total, so the same page never renders in two different orders.
        a.candidate.id - b.candidate.id,
    )
    .slice(0, limit)
    .map(({ candidate, score, reason }) => ({ ...candidate, score, reason }));
}

/** Merge TMDB's two lists into one pool, keeping their combined ordering. */
export function buildPool(
  recommendations: unknown[],
  similar: unknown[],
  fallbackType: MediaType,
): RelatedCandidate[] {
  const out: RelatedCandidate[] = [];
  const seen = new Set<number>();

  for (const raw of [...recommendations, ...similar]) {
    const item = raw as Record<string, unknown>;
    const id = Number(item.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    const title = (item.title ?? item.name) as string | undefined;
    if (!title) continue;
    seen.add(id);
    out.push({
      id,
      mediaType: item.media_type === "tv" ? "tv" : item.media_type === "movie" ? "movie" : fallbackType,
      title,
      posterPath: (item.poster_path as string | null) ?? null,
      adult: Boolean(item.adult),
      genreIds: Array.isArray(item.genre_ids) ? (item.genre_ids as number[]) : [],
      voteAverage: typeof item.vote_average === "number" ? item.vote_average : null,
      voteCount: typeof item.vote_count === "number" ? item.vote_count : null,
      releaseDate: ((item.release_date ?? item.first_air_date) as string | null) ?? null,
      overview: (item.overview as string | null) ?? null,
      tmdbRank: out.length,
      poolSize: 0,
    });
  }

  for (const item of out) item.poolSize = out.length;
  return out;
}
