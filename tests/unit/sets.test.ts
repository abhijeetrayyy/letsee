import { describe, expect, it } from "vitest";
import { personSetItems, roleFor, setKey, setLabel, setLine } from "@/lib/people/sets";

describe("a set", () => {
  it("says progress as pace, and quietly when it's done", () => {
    expect(setLine({ done: 7, total: 12, thisYear: 3 })).toBe("7 of 12 · 3 this year");
    expect(setLine({ done: 0, total: 12, thisYear: 0 })).toBe("0 of 12");
    expect(setLine({ done: 12, total: 12, thisYear: 1 })).toBe("Every one of them · 12 of 12");
  });

  it("is only what's out, from the right part of a person's work", () => {
    const work = {
      directed: [{ id: 1, type: "movie" as const, upcoming: false }, { id: 2, type: "movie" as const, upcoming: true }],
      created: [{ id: 3, type: "tv" as const, upcoming: false }],
      acted: [{ id: 4, type: "movie" as const, upcoming: false }],
    };
    expect(personSetItems("director", work)).toEqual([{ id: "1", type: "movie" }]);
    expect(personSetItems("creator", work)).toEqual([{ id: "3", type: "tv" }]);
    expect(personSetItems("actor", work)).toEqual([{ id: "4", type: "movie" }]);
  });

  it("names itself", () => {
    expect(setLabel({ kind: "list", role: null, name: "x" }, "sam")).toBe("A list by sam");
    expect(setLabel({ kind: "person", role: "director", name: "Christopher Nolan" })).toBe("Directed by");
    expect(setLabel({ kind: "person", role: "actor", name: "x" })).toBe("Starring");
    expect(setKey({ kind: "person", refId: "525", role: "director" })).toBe("person:525:director");
    expect(setKey({ kind: "list", refId: "12", role: null })).toBe("list:12:");
  });

  it("picks the role a person is known for", () => {
    expect(roleFor("Directing", { directed: 12, created: 0 })).toBe("director");
    expect(roleFor("Acting", { directed: 2, created: 0 })).toBe("actor");
    expect(roleFor("Writing", { directed: 0, created: 3 })).toBe("creator");
    expect(roleFor("Directing", { directed: 0, created: 0 })).toBe("actor");
  });
});
