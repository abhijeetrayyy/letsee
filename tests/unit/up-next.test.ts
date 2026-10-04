import { describe, expect, it } from "vitest";
import { laneOf, pickOne, pickReason, whenLabel, type Save } from "@/lib/people/lanes";

const TODAY = "2026-10-03";

describe("which lane a save sits in", () => {
  it("puts tonight, and anything dated today, in Tonight", () => {
    expect(laneOf({ saveFor: "tonight", saveForDate: null }, TODAY)).toBe("tonight");
    expect(laneOf({ saveFor: "date", saveForDate: TODAY }, TODAY)).toBe("tonight");
  });

  it("lines up the weekend and future dates", () => {
    expect(laneOf({ saveFor: "weekend", saveForDate: null }, TODAY)).toBe("lined-up");
    expect(laneOf({ saveFor: "date", saveForDate: "2026-10-11" }, TODAY)).toBe("lined-up");
  });

  it("lets a date that has passed fall back to someday rather than nag", () => {
    expect(laneOf({ saveFor: "date", saveForDate: "2026-09-01" }, TODAY)).toBe("someday");
    expect(laneOf({ saveFor: null, saveForDate: null }, TODAY)).toBe("someday");
    expect(laneOf({ saveFor: "someday", saveForDate: null }, TODAY)).toBe("someday");
  });

  it("names the plan in words", () => {
    expect(whenLabel({ saveFor: "weekend", saveForDate: null })).toBe("This weekend");
    expect(whenLabel({ saveFor: null, saveForDate: null })).toBeNull();
  });
});

describe("pick one for me", () => {
  const save = (id: string, extra: Partial<Save> = {}): Save => ({
    itemId: id,
    itemType: "movie",
    itemName: id,
    imageUrl: null,
    genres: [],
    savedAt: "2026-01-01T00:00:00Z",
    note: null,
    saveFor: null,
    saveForDate: null,
    withPerson: null,
    withName: null,
    leaving: null,
    ...extra,
  });

  it("weights what's leaving and what someone recommended", () => {
    const list = [save("plain"), save("leaving", { leaving: { provider: "Netflix", on: "2026-10-30" } }), save("from", { withName: "Priya" })];
    // weights 1, 3, 2 → total 6: [0,1) plain, [1,4) leaving, [4,6) from
    expect(pickOne(list, new Set(), () => 0.1)?.itemId).toBe("plain");
    expect(pickOne(list, new Set(), () => 0.3)?.itemId).toBe("leaving");
    expect(pickOne(list, new Set(), () => 0.9)?.itemId).toBe("from");
  });

  it("doesn't offer the same one twice in a row, unless it's all there is", () => {
    const list = [save("a"), save("b")];
    expect(pickOne(list, new Set(["movie:a"]), () => 0)?.itemId).toBe("b");
    expect(pickOne([save("a")], new Set(["movie:a"]), () => 0)?.itemId).toBe("a");
    expect(pickOne([], new Set(), () => 0)).toBeNull();
  });

  it("says why, in one line", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(pickReason(save("x", { leaving: { provider: "Netflix", on: "2026-10-30" } }), now)).toBe("Leaves Netflix 30 Oct");
    expect(pickReason(save("x", { withPerson: { id: "1", username: "priya", avatarUrl: null } }), now)).toBe("priya said you should");
    expect(pickReason(save("x", { note: "the score" }), now)).toBe("You saved it because: “the score”");
    expect(pickReason(save("x", { savedAt: "2026-09-27T12:00:00Z" }), now)).toBe("Saved 7 days ago");
    expect(pickReason(save("x", { savedAt: "2026-01-01T00:00:00Z" }), now)).toBe("Waiting 9 months");
    expect(pickReason(save("x", { savedAt: "2023-05-01T00:00:00Z" }), now)).toBe("Waiting since 2023");
  });

  it("calls a pick lined up for today tonight", () => {
    expect(whenLabel({ saveFor: "date", saveForDate: TODAY }, TODAY)).toBe("Tonight");
  });
});
