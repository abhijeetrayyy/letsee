import { describe, expect, it } from "vitest";
import { buildDiscoverQuery } from "@/utils/browseQuery";
import {
  appliedCount,
  browseHeadline,
  browseQueryString,
  buildBrowseUrl,
  parseBrowseParams,
  withBrowseFilters,
} from "@/utils/browseUrl";

const parse = (qs: string) => parseBrowseParams(Object.fromEntries(new URLSearchParams(qs)));

describe("browse lives inside Search", () => {
  it("points every browse link at Search", () => {
    expect(buildBrowseUrl({})).toBe("/app/search?browse=1");
    expect(buildBrowseUrl({ type: "tv", genre: "18" })).toBe("/app/search?browse=1&type=tv&genre=18");
  });

  it("asks the API in one canonical form, whatever order the URL was written in", () => {
    const a = parse("lang=ko&genre=53&browse=1");
    const b = parse("browse=1&genre=53&lang=ko&sort=popular&page=1");
    expect(browseQueryString(a)).toBe(browseQueryString(b));
    expect(browseQueryString(a)).toBe("genre=53&lang=ko");
  });

  it("ignores Search's own parameters and anything malformed", () => {
    const p = parse("browse=1&q=heat&scope=people&genre=abc&lang=korean&decade=1955&page=0x10");
    expect(browseQueryString(p)).toBe("");
  });

  it("keeps a page past the first for the API, and never a page for the address", () => {
    const p = parse("genre=18");
    expect(browseQueryString({ ...p, page: 3 })).toBe("genre=18&page=3");
    expect(buildBrowseUrl(withBrowseFilters({ ...p, page: 3 }, { lang: "fr" }))).toBe("/app/search?browse=1&genre=18&lang=fr");
  });
});

describe("changing filters", () => {
  it("never loses the others", () => {
    const p = parse("genre=53&lang=ko&decade=2010");
    expect(buildBrowseUrl(withBrowseFilters(p, { lang: undefined }))).toBe("/app/search?browse=1&genre=53&decade=2010");
  });

  it("carries a genre across to series where one exists, and drops it where none does", () => {
    expect(withBrowseFilters(parse("genre=28"), { type: "tv" }).genre).toBe("10759");
    expect(withBrowseFilters(parse("genre=27"), { type: "tv" }).genre).toBeUndefined();
  });

  it("lets a network or a collection decide the type", () => {
    expect(parse("network=49&type=movie").type).toBe("tv");
    expect(parse("collection=10&type=tv").type).toBe("movie");
  });
});

describe("what the page says", () => {
  it("counts applied filters for the phone's badge, including a non-default order", () => {
    expect(appliedCount(parse(""))).toBe(0);
    expect(appliedCount(parse("type=tv"))).toBe(0);
    expect(appliedCount(parse("genre=18&lang=fr&sort=rating"))).toBe(3);
  });

  it("names the set in words", () => {
    expect(browseHeadline(parse(""), {})).toBe("Films");
    expect(browseHeadline(parse("type=tv"), {})).toBe("Series");
    expect(browseHeadline(parse("genre=53&lang=ko&decade=2010"), { genre: "Thriller", lang: "Korean", decade: "2010s" })).toBe(
      "Korean thriller films from the 2010s",
    );
    expect(browseHeadline(parse("keyword=9715&genre=18"), { keyword: "time loop", genre: "Drama" })).toBe("Time loop");
  });
});

describe("what browse asks TMDB for", () => {
  const today = new Date().toISOString().slice(0, 10);
  it("only titles already out, whatever the order", () => {
    for (const sort of ["popular", "rating", "votes", "new"] as const) {
      const q = buildDiscoverQuery({ ...parseBrowseParams({ genre: "18" }), sort });
      expect(q.get("primary_release_date.lte")).toBe(today);
    }
  });
  it("keeps a decade's own ceiling when it is earlier", () => {
    const q = buildDiscoverQuery(parseBrowseParams({ genre: "18", decade: "1990" }));
    expect(q.get("primary_release_date.lte")).toBe("1999-12-31");
  });
});
