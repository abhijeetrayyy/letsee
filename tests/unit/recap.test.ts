import { describe, expect, it } from "vitest";
import { recapSentence } from "@/lib/people/recap";

describe("a recap's first sentence", () => {
  it("leads with the period, then the films, then the person", () => {
    expect(recapSentence("Your", "September 2026", 9, 0, { name: "priya", avatarUrl: null, count: 4 })).toBe("Your September 2026: 9 films, 4 with priya.");
  });

  it("names series separately and never sums them into titles", () => {
    expect(recapSentence("ray's", "2026", 1, 3, null)).toBe("ray's 2026: 1 film and 3 series.");
  });

  it("says so when there is nothing", () => {
    expect(recapSentence("Your", "March 2026", 0, 0, null)).toBe("Your March 2026: nothing logged.");
  });
});
