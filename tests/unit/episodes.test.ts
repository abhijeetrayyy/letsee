import { describe, expect, it } from "vitest";
import { earlierUnwatched, episodeLabel, epKey, isOut, leadsWithEpisode, nextEpisode, notOutYet, progressOf, rangeLabel, type SeasonInfo } from "@/lib/logging/episodes";

const seasons: SeasonInfo[] = [
  { season_number: 0, episode_count: 3 }, // specials
  { season_number: 1, episode_count: 3 },
  { season_number: 2, episode_count: 2 },
];
const w = (...eps: [number, number][]) => new Set(eps.map(([s, e]) => epKey(s, e)));

describe("the next episode", () => {
  it("starts at S01 E01 and never offers a special", () => {
    expect(nextEpisode(seasons, w(), null)).toEqual({ s: 1, e: 1 });
  });

  it("follows on, crossing into the next season", () => {
    expect(nextEpisode(seasons, w([1, 1], [1, 2]), null)).toEqual({ s: 1, e: 3 });
    expect(nextEpisode(seasons, w([1, 1], [1, 2], [1, 3]), null)).toEqual({ s: 2, e: 1 });
  });

  it("brings back an episode you skipped before anything later", () => {
    expect(nextEpisode(seasons, w([1, 1], [1, 3], [2, 1]), null)).toEqual({ s: 1, e: 2 });
  });

  it("never offers an episode that hasn't aired", () => {
    expect(nextEpisode(seasons, w([1, 1], [1, 2], [1, 3]), { s: 1, e: 3 })).toBeNull();
    expect(nextEpisode(seasons, w([1, 1]), { s: 1, e: 2 })).toEqual({ s: 1, e: 2 });
  });

  it("is nothing once you are caught up", () => {
    expect(nextEpisode(seasons, w([1, 1], [1, 2], [1, 3], [2, 1], [2, 2]), null)).toBeNull();
  });

  it("copes with a show TMDB lists in the wrong order or with empty seasons", () => {
    const messy: SeasonInfo[] = [{ season_number: 2, episode_count: 1 }, { season_number: 3, episode_count: 0 }, { season_number: 1, episode_count: 1 }];
    expect(nextEpisode(messy, w([1, 1]), null)).toEqual({ s: 2, e: 1 });
    expect(nextEpisode(messy, w([1, 1], [2, 1]), null)).toBeNull();
  });
});

describe("progress", () => {
  it("counts only aired, regular episodes", () => {
    expect(progressOf(seasons, w([0, 1], [1, 1], [1, 2]), { s: 2, e: 1 })).toEqual({ seen: 2, aired: 4 });
  });
});

describe("when the episode button leads", () => {
  it("leads once you have started, or set the show to Watching", () => {
    expect(leadsWithEpisode(w([1, 1]), null, { s: 1, e: 2 })).toBe(true);
    expect(leadsWithEpisode(w(), "watching", { s: 1, e: 1 })).toBe(true);
  });

  it("does not lead for a show you haven't begun, or have caught up on", () => {
    expect(leadsWithEpisode(w(), null, { s: 1, e: 1 })).toBe(false);
    expect(leadsWithEpisode(w(), "watchlist", { s: 1, e: 1 })).toBe(false);
    expect(leadsWithEpisode(w([1, 1]), "watching", null)).toBe(false);
  });

  it("labels an episode the way the stamp reads", () => {
    expect(episodeLabel({ s: 2, e: 1 })).toBe("S02 · E01");
  });
});

describe("marking the ones before", () => {
  it("offers every aired, unmarked episode before the one you ticked, across seasons", () => {
    expect(earlierUnwatched(seasons, w([1, 2]), { s: 2, e: 2 }, null)).toEqual([
      { s: 1, e: 1 },
      { s: 1, e: 3 },
      { s: 2, e: 1 },
    ]);
  });

  it("offers nothing when there are no gaps, and never a special", () => {
    expect(earlierUnwatched(seasons, w([1, 1], [1, 2]), { s: 1, e: 3 }, null)).toEqual([]);
    expect(earlierUnwatched(seasons, w(), { s: 1, e: 1 }, null)).toEqual([]);
  });

  it("names a run the short way and a scatter by count", () => {
    expect(rangeLabel([{ s: 1, e: 1 }, { s: 1, e: 2 }, { s: 1, e: 3 }, { s: 1, e: 4 }])).toBe("S01 E01–E04");
    expect(rangeLabel([{ s: 1, e: 1 }, { s: 1, e: 3 }])).toBe("2 earlier episodes");
    expect(rangeLabel([{ s: 1, e: 3 }, { s: 2, e: 1 }])).toBe("2 earlier episodes");
    expect(rangeLabel([{ s: 2, e: 3 }])).toBe("S02 E03");
    expect(rangeLabel([])).toBe("");
  });
});

describe("not out yet", () => {
  const today = { y: 2026, m: 10, d: 3 };
  it("is false for today and the past, true from tomorrow", () => {
    expect(notOutYet("2026-10-03", today)).toBe(false);
    expect(notOutYet("2026-10-02", today)).toBe(false);
    expect(notOutYet("2026-10-04", today)).toBe(true);
  });
  it("treats a missing or malformed date as out", () => {
    expect(notOutYet(null, today)).toBe(false);
    expect(notOutYet("2026", today)).toBe(false);
  });
});

describe("specials and undated episodes", () => {
  it("ignores a special named as the last episode to air", () => {
    expect(nextEpisode(seasons, w([1, 1]), { s: 0, e: 3 })).toEqual({ s: 1, e: 2 });
    expect(progressOf(seasons, w([1, 1]), { s: 0, e: 3 })).toEqual({ seen: 1, aired: 5 });
  });

  it("counts an undated episode as out only up to the last aired one", () => {
    const today = { y: 2026, m: 10, d: 3 };
    expect(isOut({ s: 2, e: 1 }, null, { s: 2, e: 1 }, today)).toBe(true);
    expect(isOut({ s: 2, e: 2 }, null, { s: 2, e: 1 }, today)).toBe(false);
    expect(isOut({ s: 2, e: 2 }, null, null, today)).toBe(false);
    expect(isOut({ s: 2, e: 2 }, "2026-10-01", null, today)).toBe(true);
    expect(isOut({ s: 2, e: 2 }, "2026-10-09", { s: 3, e: 1 }, today)).toBe(false);
  });
});
