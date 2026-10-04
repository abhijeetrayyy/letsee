import { describe, expect, it } from "vitest";
import { firstSentence, searchMeta } from "@/lib/search/meta";

describe("what a search result says", () => {
  it("names the first genre, plainly", () => {
    expect(searchMeta({ genre_ids: [878, 18] }).genre).toBe("Sci-fi");
    expect(searchMeta({ genre_ids: [10759, 10765] }).genre).toBe("Action");
    expect(searchMeta({ genre_ids: [] }).genre).toBeNull();
  });
  it("calls Japanese animation anime", () => {
    expect(searchMeta({ genre_ids: [16, 10759], original_language: "ja" }).genre).toBe("Anime");
    expect(searchMeta({ genre_ids: [16], original_language: "en" }).genre).toBe("Animation");
  });
  it("shows a score only with enough votes", () => {
    expect(searchMeta({ vote_average: 8.46, vote_count: 37000 }).rating).toBe(8.5);
    expect(searchMeta({ vote_average: 10, vote_count: 3 }).rating).toBeNull();
    expect(searchMeta({ vote_average: 0, vote_count: 100 }).rating).toBeNull();
  });
  it("keeps the first sentence, cut at a word", () => {
    expect(firstSentence("A thief who steals secrets. He is offered a chance.")).toBe("A thief who steals secrets.");
    expect(firstSentence("  ")).toBeNull();
    const long = "word ".repeat(60).trim() + ".";
    const out = firstSentence(long)!;
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(141);
  });
});
