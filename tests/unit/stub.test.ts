import { describe, expect, it } from "vitest";
import { starGlyphs, stubDay, stubPlace, stubPoster, stubWith, stubWords } from "@/lib/people/stub";

describe("a diary entry as a stub", () => {
  it("writes stars as glyphs, halves included", () => {
    expect(starGlyphs(9)).toBe("★★★★½");
    expect(starGlyphs(10)).toBe("★★★★★");
    expect(starGlyphs(1)).toBe("½");
    expect(starGlyphs(null)).toBe("");
  });

  it("dates it the way a ticket does, year and all", () => {
    expect(stubDay("2026-10-11")).toBe("SUN 11 OCT 2026");
  });

  it("says where and who, briefly", () => {
    expect(stubPlace("cinema")).toBe("At the cinema");
    expect(stubPlace(null)).toBe("At home");
    expect(stubWith([])).toBe("");
    expect(stubWith(["Priya"])).toBe("with Priya");
    expect(stubWith(["Priya", "Sam"])).toBe("with Priya and Sam");
    expect(stubWith(["Priya", "Sam", "jojo", "neha"])).toBe("with Priya, Sam and 2 more");
  });

  it("keeps their words to what a picture holds, cut at a word", () => {
    const long = "The sand, the sound, the scale of it — I could not look away for a single second and then it simply ended and we sat there in silence";
    const out = stubWords(long, 80);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
    expect(stubWords("  short  ")).toBe("short");
  });

  it("asks TMDB for a sharper poster", () => {
    expect(stubPoster("https://image.tmdb.org/t/p/w342/abc.jpg")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
    expect(stubPoster("/pixeled.webp")).toBe("/pixeled.webp");
  });
});
