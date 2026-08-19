import { describe, expect, it } from "vitest";
import { tvSeasonLd, tvEpisodeLd } from "@/utils/structuredData";
import { parseRouteId } from "@/utils/urls";

/**
 * The failure these guard against is a JSON-LD graph that describes real things
 * with URLs that 404. That is strictly worse than emitting nothing: a crawler
 * trusts the node, follows the link, and finds a dead page.
 *
 * So every url asserted here is checked two ways — that it is absolute, and
 * that the id embedded in the slug survives a round trip through parseRouteId,
 * which is the same function the route handlers use to resolve it.
 */

const path = (url: string) => new URL(url).pathname;
const idFromSegment = (segment: string) => parseRouteId(segment);

describe("tvSeasonLd", () => {
  const ld = tvSeasonLd({
    showId: 1396,
    showName: "Breaking Bad",
    seasonNumber: 2,
    name: "Season 2",
    overview: "Walt and Jesse go deeper.",
    posterPath: "/poster.jpg",
    airDate: "2009-03-08",
    episodeCount: 13,
  }) as any;

  it("is a TVSeason bound to its series", () => {
    expect(ld["@type"]).toBe("TVSeason");
    expect(ld.seasonNumber).toBe(2);
    expect(ld.numberOfEpisodes).toBe(13);
    expect(ld.partOfSeries["@type"]).toBe("TVSeries");
    expect(ld.partOfSeries.name).toBe("Breaking Bad");
  });

  it("points at a URL whose id the router can still read", () => {
    const segments = path(ld.url).split("/").filter(Boolean);
    // /app/tv/1396-breaking-bad/season/2
    expect(segments).toEqual(["app", "tv", "1396-breaking-bad", "season", "2"]);
    expect(idFromSegment(segments[2])).toBe("1396");
    expect(idFromSegment(path(ld.partOfSeries.url).split("/")[3])).toBe("1396");
  });

  it("falls back to a season name when TMDB has none", () => {
    const bare = tvSeasonLd({ showId: 1, showName: "X", seasonNumber: 4 }) as any;
    expect(bare.name).toBe("Season 4");
    // compact() must drop the keys we had no data for, not emit nulls.
    expect(bare).not.toHaveProperty("description");
    expect(bare).not.toHaveProperty("image");
  });
});

describe("tvEpisodeLd", () => {
  const ld = tvEpisodeLd({
    showId: 1396,
    showName: "Breaking Bad",
    seasonNumber: 5,
    episodeNumber: 14,
    name: "Ozymandias",
    overview: "Everything comes apart.",
    stillPath: "/still.jpg",
    airDate: "2013-09-15",
    runtime: 48,
  }) as any;

  it("nests inside both its season and its series", () => {
    expect(ld["@type"]).toBe("TVEpisode");
    expect(ld.episodeNumber).toBe(14);
    expect(ld.partOfSeason.seasonNumber).toBe(5);
    expect(ld.partOfSeries.name).toBe("Breaking Bad");
  });

  it("expresses runtime as an ISO 8601 duration, not a bare number", () => {
    // schema.org timeRequired is a Duration; "48" is silently ignored.
    expect(ld.timeRequired).toBe("PT48M");
  });

  it("links to a season URL identical to the one the season page emits", () => {
    const fromSeasonPage = tvSeasonLd({
      showId: 1396,
      showName: "Breaking Bad",
      seasonNumber: 5,
    }) as any;
    // If these ever diverge, the graph describes two different seasons.
    expect(ld.partOfSeason.url).toBe(fromSeasonPage.url);
  });

  it("keeps the id readable through the episode slug", () => {
    const segments = path(ld.url).split("/").filter(Boolean);
    expect(segments).toEqual([
      "app", "tv", "1396-breaking-bad", "season", "5", "episode", "14",
    ]);
    expect(idFromSegment(segments[2])).toBe("1396");
  });
});
