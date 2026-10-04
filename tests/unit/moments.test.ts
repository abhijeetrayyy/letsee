import { describe, expect, it } from "vitest";
import { pickMoments, stars, type Rating } from "@/lib/people/moments";

const r = (key: string, score: number, at = "2026-09-01"): Rating => ({ key, score, at });

describe("where two people meet", () => {
  it("picks films you both loved, best first, then the widest split", () => {
    const mine = [r("movie:1", 10), r("movie:2", 9), r("movie:3", 10), r("movie:4", 9), r("movie:5", 6)];
    const theirs = [r("movie:1", 10), r("movie:2", 9), r("movie:3", 9), r("movie:4", 3), r("movie:5", 8)];
    expect(pickMoments(mine, theirs)).toEqual([
      { kind: "both", key: "movie:1", mine: 10, theirs: 10 },
      { kind: "both", key: "movie:3", mine: 10, theirs: 9 },
      { kind: "split", key: "movie:4", mine: 9, theirs: 3 },
    ]);
  });

  it("finds nothing when you have rated nothing in common", () => {
    expect(pickMoments([r("movie:1", 10)], [r("tv:1", 10)])).toEqual([]);
  });

  it("keeps a film and a series with the same id apart", () => {
    expect(pickMoments([r("movie:7", 10)], [r("tv:7", 10)])).toEqual([]);
  });

  it("writes scores as stars", () => {
    expect(stars(10)).toBe("★5");
    expect(stars(9)).toBe("★4½");
    expect(stars(1)).toBe("★½");
  });
});
