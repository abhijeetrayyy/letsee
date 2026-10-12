import { describe, expect, it } from "vitest";
import { householdLine } from "@/lib/people/household";

const seasons = [
  { season_number: 1, episode_count: 9 },
  { season_number: 2, episode_count: 10 },
];
const last = { s: 2, e: 10 };

describe("where someone you live with is", () => {
  it("says the gap in episodes, across seasons", () => {
    expect(householdLine("priya", { s: 2, e: 2 }, { s: 2, e: 4 }, seasons, last)).toBe("priya's at S02 · E02 — 2 episodes behind you");
    expect(householdLine("priya", { s: 2, e: 1 }, { s: 1, e: 9 }, seasons, last)).toBe("priya's at S02 · E01 — 1 episode ahead");
  });

  it("says when you're level, or when either hasn't begun", () => {
    expect(householdLine("priya", { s: 1, e: 3 }, { s: 1, e: 3 }, seasons, last)).toBe("priya's with you at S01 · E03");
    expect(householdLine("priya", null, { s: 1, e: 3 }, seasons, last)).toBe("priya hasn't started it");
    expect(householdLine("priya", { s: 1, e: 3 }, null, seasons, last)).toBe("priya's at S01 · E03");
    expect(householdLine("priya", null, null, seasons, last)).toBe("Neither of you has started it");
  });
});
