import { describe, expect, it } from "vitest";
import { groupWeek, dayPartOf, names, personLine, whenWatched } from "@/lib/people/home";
import type { PersonViewing, PersonWatching } from "@/lib/db/peopleActivity";

// Saturday 3 October 2026, 21:00 local.
const NOW = new Date(2026, 9, 3, 21, 0);
const v = (userId: string, itemId: string, itemName: string, watchedOn: string): PersonViewing => ({
  userId,
  itemId,
  itemType: "movie",
  itemName,
  imageUrl: null,
  watchedOn,
  at: `${watchedOn}T22:00:00Z`,
});
const w = (userId: string, itemName: string): PersonWatching => ({ userId, itemId: "1", itemType: "tv", itemName, imageUrl: null, at: "2026-10-01T00:00:00Z" });

describe("the hour decides the first card", () => {
  it("is evening from five, morning from five to noon, day otherwise", () => {
    expect(dayPartOf(17)).toBe("evening");
    expect(dayPartOf(23)).toBe("evening");
    expect(dayPartOf(4)).toBe("day");
    expect(dayPartOf(5)).toBe("morning");
    expect(dayPartOf(11)).toBe("morning");
    expect(dayPartOf(12)).toBe("day");
  });
});

describe("a person's one line", () => {
  it("leads with something watched in the last three days", () => {
    expect(personLine("p", [v("p", "1", "Past Lives", "2026-10-02")], [w("p", "The Bear")], [{ itemName: "Dune" }], NOW)).toBe(
      "watched Past Lives last night",
    );
  });

  it("then a pass, then what they are watching, then the rest of the week", () => {
    expect(personLine("p", [], [w("p", "The Bear")], [{ itemName: "Dune" }], NOW)).toBe("passed you Dune");
    expect(personLine("p", [], [w("p", "The Bear")], [{ itemName: "A" }, { itemName: "B" }], NOW)).toBe("passed you 2 films");
    expect(personLine("p", [v("p", "1", "Heat", "2026-09-28")], [w("p", "The Bear")], [], NOW)).toBe("watching The Bear");
    expect(personLine("p", [v("p", "1", "Heat", "2026-09-28")], [], [], NOW)).toBe("watched Heat on Monday");
  });

  it("says nothing rather than inventing something", () => {
    expect(personLine("p", [v("q", "1", "Heat", "2026-10-03")], [], [], NOW)).toBeNull();
  });
});

describe("the week, grouped by film", () => {
  it("puts several people on one film into one entry, newest first", () => {
    const week = groupWeek([v("a", "1", "Challengers", "2026-10-01"), v("b", "2", "Heat", "2026-10-02"), v("c", "1", "Challengers", "2026-09-29")]);
    expect(week.map((g) => [g.itemName, g.userIds])).toEqual([
      ["Heat", ["b"]],
      ["Challengers", ["a", "c"]],
    ]);
  });

  it("names people the way a person would", () => {
    expect(names(["Priya"])).toBe("Priya");
    expect(names(["Priya", "Kabir"])).toBe("Priya and Kabir");
    expect(names(["Priya", "Kabir", "Mei", "Sam"])).toBe("Priya, Kabir and 2 more");
  });

  it("says today and last night", () => {
    expect(whenWatched("2026-10-03", NOW)).toBe("today");
    expect(whenWatched("2026-10-02", NOW)).toBe("last night");
    expect(whenWatched("2026-09-29", NOW)).toBe("on Tuesday");
    expect(whenWatched("2026-08-12", NOW)).toBe("on 12 Aug");
    expect(whenWatched("2025-12-31", NOW)).toBe("on 31 Dec 2025");
  });
});
