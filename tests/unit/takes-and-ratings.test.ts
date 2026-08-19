import { describe, expect, it } from "vitest";
import { parseIdentity, NA } from "@/utils/takes";
import { scoreToStars, starsToScore, clampScore } from "@/utils/ratingScale";

/**
 * parseIdentity is the application's copy of the `takes_scope_shape` CHECK
 * constraint from migration 065. Two copies of one rule is exactly the shape
 * this codebase keeps getting wrong, so the point of these is that the copy
 * stays honest: anything parseIdentity accepts, the constraint must accept.
 *
 * The sentinel matters more than it looks. Season 0 is Specials — a real
 * season — so "not applicable" has to be -1 and cannot be 0.
 */
describe("parseIdentity", () => {
  it("uses -1, not 0, for a title-scoped take", () => {
    expect(NA).toBe(-1);
    expect(parseIdentity({ itemId: "550", itemType: "movie", scope: "title" })).toEqual({
      itemId: "550",
      itemType: "movie",
      scope: "title",
      seasonNumber: -1,
      episodeNumber: -1,
    });
  });

  it("accepts season 0, because Specials is a season", () => {
    const id = parseIdentity({ itemId: "1396", itemType: "tv", scope: "season", seasonNumber: 0 });
    expect(id).not.toBeNull();
    expect(id!.seasonNumber).toBe(0);
    expect(id!.episodeNumber).toBe(-1);
  });

  it("requires an episode number of at least 1 at episode scope", () => {
    const base = { itemId: "1396", itemType: "tv", scope: "episode", seasonNumber: 1 };
    expect(parseIdentity({ ...base, episodeNumber: 0 })).toBeNull();
    expect(parseIdentity({ ...base, episodeNumber: 1 })).not.toBeNull();
  });

  it("rejects a negative season rather than passing it to the constraint", () => {
    // Rejecting here is a 400; letting it through is a 500 from Postgres.
    expect(
      parseIdentity({ itemId: "1396", itemType: "tv", scope: "season", seasonNumber: -1 }),
    ).toBeNull();
  });

  it("refuses an identity with no item id", () => {
    expect(parseIdentity({ itemType: "movie", scope: "title" })).toBeNull();
    expect(parseIdentity({ itemId: "   ", itemType: "movie", scope: "title" })).toBeNull();
  });

  it("defaults an unknown scope or type rather than inventing one", () => {
    const id = parseIdentity({ itemId: "550", itemType: "film", scope: "chapter" });
    expect(id).toEqual({
      itemId: "550",
      itemType: "movie",
      scope: "title",
      seasonNumber: -1,
      episodeNumber: -1,
    });
  });
});

/**
 * Stars are presentation; the stored score is 1–10 and every read path
 * (rating_distribution, the cached stats, the API contract) depends on that.
 * The conversion has to be lossless in both directions or a rating drifts
 * every time it is displayed and re-saved.
 */
describe("rating scale", () => {
  it("round-trips every storable score through stars without drift", () => {
    for (let score = 1; score <= 10; score += 1) {
      expect(starsToScore(scoreToStars(score))).toBe(score);
    }
  });

  it("maps the ends of the scale to the ends of the stars", () => {
    expect(scoreToStars(1)).toBe(0.5);
    expect(scoreToStars(10)).toBe(5);
  });

  it("clamps into the storable range instead of writing an invalid score", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-4)).toBe(1);
    expect(clampScore(11)).toBe(10);
    expect(clampScore(7.4)).toBe(7);
  });
});
