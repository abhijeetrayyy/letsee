import { describe, expect, it } from "vitest";
import { communityFrom, communityReason, rankRelated, type RelatedCandidate, type RelatedSeed } from "@/utils/related";

/**
 * The community signal, read in the browser by the related row since it left
 * the page build (25 Oct 2026): how the rows from `related_by_audience` become
 * evidence, and what a card then says.
 */
describe("the related row's community line", () => {
  it("reads who here watched the seed, and how many watched each title", () => {
    const c = communityFrom([
      { item_id: "155", co_watchers: 2, seed_watchers: 7 },
      { item_id: "680", co_watchers: 1, seed_watchers: 7 },
      { item_id: "not-a-number", co_watchers: 5, seed_watchers: 7 },
    ]);
    expect(c?.seedWatchers).toBe(7);
    expect(c?.byId.get(155)).toBe(2);
    expect(c?.byId.get(680)).toBe(1);
    expect(c?.byId.size).toBe(2);
  });

  it("is nothing — not a zero — when nobody here has watched it", () => {
    expect(communityFrom([])).toBeUndefined();
    expect(communityFrom(null)).toBeUndefined();
    expect(communityFrom([{ item_id: "155", co_watchers: 0, seed_watchers: 0 }])).toBeUndefined();
  });

  it("says a count, not a rate", () => {
    expect(communityReason("Inception", 2, 7)).toBe("Watched by 2 of the 7 people here who saw Inception.");
  });

  it("ranks the same without it: the page's order doesn't wait on the database", () => {
    const seed: RelatedSeed = { id: 27205, mediaType: "movie", title: "Inception", keywordIds: [], keywordNames: new Map(), peopleIds: [], peopleNames: new Map(), collectionId: null, collectionName: null };
    const pool = [155, 680, 13].map((id, i) => ({ id, mediaType: "movie", title: `T${id}`, posterPath: null, adult: false, releaseDate: null, tmdbRank: i, poolSize: 3 }) as unknown as RelatedCandidate);
    const ranked = rankRelated(seed, pool, {});
    expect(ranked.map((r) => r.id)).toEqual([155, 680, 13]);
    expect(ranked.every((r) => !r.reason.startsWith("Watched by"))).toBe(true);
  });
});
