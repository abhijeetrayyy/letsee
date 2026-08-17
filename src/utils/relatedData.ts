import { unstable_cache } from "next/cache";
import { tmdbFetchJson } from "@/utils/tmdb";
import { createClient } from "@/utils/supabase/server";
import {
  buildPool,
  rankRelated,
  type MediaType,
  type RelatedCandidate,
  type RelatedEvidence,
  type RelatedItem,
  type RelatedSeed,
} from "@/utils/related";

/**
 * The side of D5 that needs a network and a database.
 *
 * Kept apart from `related.ts` so the ranking stays verifiable without either.
 *
 * Everything here is wrapped in `unstable_cache`, and that is not an
 * optimisation. `fetchTmdb` calls `waitForSlot()` *before* every request, so
 * its 120ms rate-limit gap is paid whether or not Next serves the response
 * from the Data Cache — the same pathology that pinned `/api/search/catalog` at
 * a flat 3.95s until the whole function was cached. Enriching a pool means
 * ~20 calls, so uncached this would be seconds of throttle on every render,
 * and the throttle is process-wide: it would slow down every other page too.
 */

const BASE = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY;

/**
 * Enrich exactly as many as we show, and no more.
 *
 * Enriching a wider pool would rank better — a strong keyword match sitting at
 * TMDB position 15 never gets the chance to climb — but every extra candidate
 * is another throttled TMDB call on a cold render. Measured end-to-end on the
 * real page: 18 candidates cost **5.4s** cold, 12 cost **2.1–4.7s**, and both
 * are **0.33s** warm. The cheaper number won; ranking the top 12 by real
 * evidence and attaching reasons is where nearly all the value is.
 *
 * Enrich-what-you-rank is also a correctness rule, not only a budget. Ranking
 * a wider pool than we enrich would let "we didn't check this one" outscore
 * "we checked and it doesn't match", because an unknown term is renormalised
 * away while a known zero counts against the score.
 */
const ENRICH = 12;
const SHOW = 12;

/** Keywords change about never. */
const KEYWORD_TTL = 86400;
const FILMOGRAPHY_TTL = 86400;

type Raw = Record<string, unknown>;

/**
 * One title's keyword ids.
 *
 * Cached per title rather than per page, so a candidate appearing on twenty
 * different detail pages is fetched once a day, not twenty times.
 */
const keywordsFor = unstable_cache(
  async (mediaType: MediaType, id: number): Promise<number[]> => {
    if (!KEY) return [];
    const { data } = await tmdbFetchJson<Raw>(
      `${BASE}/${mediaType}/${id}/keywords?api_key=${KEY}`,
      "related:keywords",
      { revalidate: KEYWORD_TTL },
    );
    // TMDB spells the container differently for film and TV, which is a real
    // difference and not defensive coding: `keywords` on movie, `results` on tv.
    const list = (data?.keywords ?? data?.results) as { id?: number }[] | undefined;
    return Array.isArray(list) ? list.map((k) => Number(k.id)).filter(Number.isInteger) : [];
  },
  ["related-keywords-v1"],
  { revalidate: KEYWORD_TTL },
);

/**
 * Everything this director — or, for a series, this creator — also made.
 *
 * One call, not one per candidate. TMDB's recommendation results carry no
 * crew at all, so without this the "same director" signal has no data on the
 * candidate side and could only ever score zero.
 *
 * The two media types need different endpoints, and finding out why cost a
 * measurement: `/discover/tv?with_crew=` does not filter, it is **ignored**.
 * Asking for Vince Gilligan's series returns 229,203 results — the entire
 * catalogue — exactly as `/discover/tv` silently ignores `primary_release_date`.
 * `/person/{id}/tv_credits` is the endpoint that actually answers it.
 */
const filmographyFor = unstable_cache(
  async (mediaType: MediaType, personIds: number[]): Promise<number[]> => {
    if (!KEY || personIds.length === 0) return [];
    const ids = new Set<number>();

    await Promise.all(
      personIds.slice(0, 2).map(async (personId) => {
        if (mediaType === "movie") {
          const { data } = await tmdbFetchJson<Raw>(
            `${BASE}/discover/movie?api_key=${KEY}&with_crew=${personId}&sort_by=popularity.desc`,
            "related:filmography",
            { revalidate: FILMOGRAPHY_TTL },
          );
          for (const r of (data?.results ?? []) as { id?: number }[]) {
            if (Number.isInteger(r.id)) ids.add(Number(r.id));
          }
        } else {
          const { data } = await tmdbFetchJson<Raw>(
            `${BASE}/person/${personId}/tv_credits?api_key=${KEY}`,
            "related:tv-credits",
            { revalidate: FILMOGRAPHY_TTL },
          );
          for (const r of [
            ...((data?.crew ?? []) as { id?: number }[]),
            ...((data?.cast ?? []) as { id?: number }[]),
          ]) {
            if (Number.isInteger(r.id)) ids.add(Number(r.id));
          }
        }
      }),
    );

    return [...ids];
  },
  ["related-filmography-v1"],
  { revalidate: FILMOGRAPHY_TTL },
);

const collectionPartsFor = unstable_cache(
  async (collectionId: number): Promise<number[]> => {
    if (!KEY) return [];
    const { data } = await tmdbFetchJson<Raw>(
      `${BASE}/collection/${collectionId}?api_key=${KEY}`,
      "related:collection",
      { revalidate: FILMOGRAPHY_TTL },
    );
    return ((data?.parts ?? []) as { id?: number }[])
      .map((p) => Number(p.id))
      .filter(Number.isInteger);
  },
  ["related-collection-v1"],
  { revalidate: FILMOGRAPHY_TTL },
);

/**
 * The community half — the one signal a TMDB-backed competitor cannot copy.
 *
 * Depends on `related_by_audience`, added by migration `066`. That migration
 * is **written but not applied**, so in practice this returns `undefined`
 * today and the ranking renormalises the term away. That is the designed
 * behaviour rather than a failure path: D5's second acceptance criterion is
 * that the section degrades without an empty state, and this is how.
 *
 * Any error is swallowed for the same reason. A missing function, a permission
 * problem or an empty community are all the same thing to the caller — no
 * signal — and none of them should cost the page its related section.
 */
async function communityFor(
  seedId: number,
  mediaType: MediaType,
): Promise<RelatedEvidence["community"]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("related_by_audience", {
      p_item_id: String(seedId),
      p_item_type: mediaType,
      p_limit: 200,
    });
    if (error || !Array.isArray(data) || data.length === 0) return undefined;

    const byId = new Map<number, number>();
    let seedWatchers = 0;
    for (const row of data as { item_id: string; co_watchers: number; seed_watchers: number }[]) {
      const id = Number(row.item_id);
      if (Number.isInteger(id)) byId.set(id, Number(row.co_watchers) || 0);
      seedWatchers = Number(row.seed_watchers) || seedWatchers;
    }
    return seedWatchers > 0 ? { seedWatchers, byId } : undefined;
  } catch {
    return undefined;
  }
}

export type RelatedInput = {
  id: number;
  mediaType: MediaType;
  title: string;
  keywords: { id: number; name: string }[];
  people: { id: number; name: string }[];
  collection: { id: number; name: string } | null;
  recommendations: unknown[];
  similar: unknown[];
};

/**
 * Build the ranked, reasoned related list for one title.
 *
 * The pool is free — `recommendations` and `similar` both arrive on the detail
 * page's single `append_to_response` call and are currently rendered as two
 * separate rails that say nothing about why anything is in them.
 */
export async function getRelated(input: RelatedInput): Promise<RelatedItem[]> {
  const seed: RelatedSeed = {
    id: input.id,
    mediaType: input.mediaType,
    title: input.title,
    keywordIds: input.keywords.map((k) => k.id),
    keywordNames: new Map(input.keywords.map((k) => [k.id, k.name])),
    peopleIds: input.people.map((p) => p.id),
    peopleNames: new Map(input.people.map((p) => [p.id, p.name])),
    collectionId: input.collection?.id ?? null,
    collectionName: input.collection?.name ?? null,
  };

  const pool = buildPool(input.recommendations, input.similar, input.mediaType);
  if (pool.length === 0) return [];

  // Rank exactly the candidates we enrich. Enriching a subset and ranking the
  // whole pool would let "we didn't check" beat "we checked and it doesn't
  // match", because an unknown term is renormalised away while a known zero
  // counts against the score.
  const considered: RelatedCandidate[] = pool.slice(0, ENRICH);

  const [keywordPairs, filmography, collectionParts, community] = await Promise.all([
    Promise.all(
      considered.map(async (c) => [c.id, await keywordsFor(c.mediaType, c.id)] as const),
    ),
    seed.peopleIds.length > 0 ? filmographyFor(seed.mediaType, seed.peopleIds) : Promise.resolve([]),
    seed.collectionId != null ? collectionPartsFor(seed.collectionId) : Promise.resolve([]),
    communityFor(seed.id, seed.mediaType),
  ]);

  const evidence: RelatedEvidence = {
    keywordIds: new Map(keywordPairs),
    filmographyIds: seed.peopleIds.length > 0 ? new Set(filmography) : undefined,
    collectionPartIds: seed.collectionId != null ? new Set(collectionParts) : undefined,
    community,
  };

  return rankRelated(seed, considered, evidence, SHOW);
}
