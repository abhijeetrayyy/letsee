import { describe, expect, it } from "vitest";
import { rankBecause } from "@/utils/title/because";

const seed = { id: 1, language: "hi", year: 2010, genreIds: [80, 18] };
const c = (id: number, extra: Record<string, unknown> = {}) => ({ id, title: `T${id}`, poster_path: "/p.jpg", release_date: "2012-01-01", original_language: "en", genre_ids: [], vote_count: 100, ...extra });

describe("because you love", () => {
  it("prefers the favourite's own language, era and genres over TMDB's raw order", () => {
    const noir = c(2, { release_date: "1947-01-01", genre_ids: [80] });
    const bombay = c(3, { original_language: "hi", genre_ids: [80, 18] });
    const out = rankBecause(seed, [noir], [bombay], "movie");
    expect(out.map((x) => x.id)).toEqual([3, 2]);
  });
  it("counts a title on both lists once, higher", () => {
    const both = c(4);
    const one = c(5);
    expect(rankBecause(seed, [one, both], [both], "movie").map((x) => x.id)).toEqual([4, 5]);
  });
  it("drops stubs, the favourite itself and posterless entries", () => {
    const out = rankBecause(seed, [c(1), c(6, { vote_count: 3 }), c(7, { poster_path: null }), c(8)], [], "tv");
    expect(out.map((x) => x.id)).toEqual([8]);
    expect(out[0]).toMatchObject({ type: "tv", year: "2012", posterPath: "/p.jpg" });
  });
});
