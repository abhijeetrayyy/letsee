import { describe, expect, it } from "vitest";
import { whosWhere } from "@/lib/people/seriesRoom";

const seasons = [
  { season_number: 1, episode_count: 3 },
  { season_number: 2, episode_count: 4 },
];
const last = { s: 2, e: 4 };
const through = (...keys: string[]) => new Set(keys);

describe("a room for a series", () => {
  it("seats everyone, furthest first, and finds the next episode you can all watch", () => {
    const r = whosWhere(
      [
        { person: "ray", watched: through("1:1", "1:2", "1:3", "2:1") },
        { person: "priya", watched: through("1:1", "1:2", "1:3", "2:1", "2:2", "2:3") },
        { person: "sam", watched: through("1:1", "1:2") },
      ],
      seasons,
      last,
    );
    expect(r.seats.map((s) => `${s.person}:${s.seen}`)).toEqual(["priya:6", "ray:4", "sam:2"]);
    expect(r.aired).toBe(7);
    expect(r.together).toEqual({ s: 1, e: 3 });
    expect(r.started).toBe(3);
  });

  it("starts at the beginning when someone hasn't begun", () => {
    const r = whosWhere([{ person: "ray", watched: through("1:1") }, { person: "sam", watched: through() }], seasons, last);
    expect(r.together).toEqual({ s: 1, e: 1 });
    expect(r.started).toBe(1);
  });

  it("has nothing left to watch together when everyone's caught up", () => {
    const all = through("1:1", "1:2", "1:3", "2:1", "2:2", "2:3", "2:4");
    expect(whosWhere([{ person: "a", watched: all }, { person: "b", watched: all }], seasons, last).together).toBeNull();
  });
});
