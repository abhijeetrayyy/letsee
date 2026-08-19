import { describe, expect, it } from "vitest";
import { episodePath, listPath, parseRouteId, personPath, seasonPath, slugify, titlePath } from "@/utils/urls";

/**
 * The slug is the part of a URL a person reads before they click it, so it has
 * to survive real film titles rather than tidy ones.
 */
describe("slugify", () => {
  it("folds accents instead of dropping the letter", () => {
    // "amlie" would be a different word.
    expect(slugify("Amélie")).toBe("amelie");
    expect(slugify("Léon")).toBe("leon");
  });

  it("drops apostrophes rather than turning them into separators", () => {
    // "don-t-look-up" reads as three words; it is two.
    expect(slugify("Don't Look Up")).toBe("dont-look-up");
    expect(slugify("It’s a Wonderful Life")).toBe("its-a-wonderful-life");
  });

  it("collapses punctuation runs to a single hyphen", () => {
    expect(slugify("Spider-Man: No Way Home")).toBe("spider-man-no-way-home");
    expect(slugify("WALL·E")).toBe("wall-e");
    expect(slugify("Am I Ok?")).toBe("am-i-ok");
  });

  it("never leaves a leading or trailing hyphen", () => {
    for (const input of ["  padded  ", "...Ellipsis", "Trailing!!!", "-dash-"]) {
      const out = slugify(input);
      expect(out.startsWith("-")).toBe(false);
      expect(out.endsWith("-")).toBe(false);
    }
  });

  it("returns empty for a title with nothing transliterable, so the id stands alone", () => {
    expect(slugify("日本語")).toBe("");
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
  });

  it("caps length without ending mid-hyphen", () => {
    const out = slugify("a".repeat(200));
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith("-")).toBe(false);
  });
});

/**
 * Every title route already accepted a slug before any link produced one — six
 * copies of this parser, one per route file. It has to stay total: a param that
 * is not a number at all returns null, never NaN, so callers have one check.
 */
describe("parseRouteId", () => {
  it("reads the id off a slugged param", () => {
    expect(parseRouteId("550-fight-club")).toBe("550");
    expect(parseRouteId("1396-breaking-bad")).toBe("1396");
  });

  it("still reads a bare id, so old links never break", () => {
    expect(parseRouteId("550")).toBe("550");
  });

  it("returns null for anything that does not start with digits", () => {
    for (const bad of ["", null, undefined, "fight-club", "-550", "abc123"]) {
      expect(parseRouteId(bad)).toBeNull();
    }
  });
});

describe("path builders", () => {
  it("puts the name in the path", () => {
    expect(titlePath("movie", 550, "Fight Club")).toBe("/app/movie/550-fight-club");
    expect(titlePath("tv", 1396, "Breaking Bad")).toBe("/app/tv/1396-breaking-bad");
    expect(personPath(287, "Brad Pitt")).toBe("/app/person/287-brad-pitt");
  });

  it("falls back to the bare id when there is no usable name", () => {
    // A card that has not loaded its title yet must still link somewhere real.
    expect(titlePath("movie", 550)).toBe("/app/movie/550");
    expect(titlePath("movie", 550, "日本語")).toBe("/app/movie/550");
  });

  it("treats anything that is not 'tv' as a film, matching the route tree", () => {
    expect(titlePath("movie", 1, "X")).toBe("/app/movie/1-x");
    expect(titlePath(undefined, 1, "X")).toBe("/app/movie/1-x");
  });

  it("keeps season and episode numbers unslugged, because they are numbers", () => {
    expect(seasonPath(1396, 2, "Breaking Bad")).toBe("/app/tv/1396-breaking-bad/season/2");
    expect(episodePath(1396, 2, 5, "Breaking Bad")).toBe(
      "/app/tv/1396-breaking-bad/season/2/episode/5",
    );
  });

  it("round-trips: every path it builds parses back to the id it was given", () => {
    for (const name of ["Fight Club", "Amélie", "日本語", "", "Spider-Man: No Way Home"]) {
      const path = titlePath("movie", 550, name);
      expect(parseRouteId(path.split("/").pop()!)).toBe("550");
    }
  });
});

/**
 * Lists were the last public page type whose URL never carried its own name —
 * and a list's entire identity is the name someone gave it. They are published
 * in the sitemap, so the nameless form was the one Google indexed.
 */
describe("listPath", () => {
  it("carries the list name", () => {
    expect(listPath(12, "Films that ruined me")).toBe("/app/lists/12-films-that-ruined-me");
  });

  it("falls back to the bare id when a list is unnamed", () => {
    expect(listPath(12, "")).toBe("/app/lists/12");
    expect(listPath(12, null)).toBe("/app/lists/12");
  });

  it("round-trips through parseRouteId, which is how the route reads it", () => {
    // The route does Number(parseRouteId(listId)); a slug it cannot parse back
    // to a bigint is a 404 on a page the sitemap advertises.
    const segment = listPath(12, "Films that ruined me").split("/").pop()!;
    expect(parseRouteId(segment)).toBe("12");
    expect(Number(parseRouteId(segment))).toBe(12);
  });
});
