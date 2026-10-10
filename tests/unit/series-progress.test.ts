import { describe, expect, it } from "vitest";
import { hasStarted, offersNextCheck, seriesLine, type SeriesProgress } from "@/lib/logging/seriesProgress";

const base: SeriesProgress = {
  episodes_watched: 3,
  total_episodes: 10,
  next_season: 1,
  next_episode: 4,
  all_complete: false,
  caught_up: false,
  next_air_date: null,
  tv_status: "watching",
};

describe("a series on a profile", () => {
  it("says where you are next", () => {
    expect(seriesLine(base)).toBe("Next S01 · E04");
  });

  it("says On hold or Dropped, without losing where you were", () => {
    expect(seriesLine({ ...base, tv_status: "on_hold" })).toBe("Next S01 · E04 · On hold");
    expect(seriesLine({ ...base, tv_status: "dropped" })).toBe("Next S01 · E04 · Dropped");
  });

  it("tells finished from caught up", () => {
    expect(seriesLine({ ...base, all_complete: true, next_season: null, next_episode: null, tv_status: "watched" })).toBe("Finished");
    expect(seriesLine({ ...base, caught_up: true, next_air_date: "2026-03-12" })).toBe("Caught up · next airs 12 Mar");
    expect(seriesLine({ ...base, caught_up: true })).toBe("Caught up");
  });

  it("does not offer an episode for a show you haven't begun", () => {
    const saved = { ...base, episodes_watched: 0, tv_status: "watchlist", total_episodes: 62 };
    expect(hasStarted(saved)).toBe(false);
    expect(seriesLine(saved)).toBe("Want to watch · 62 episodes");
    expect(offersNextCheck(saved, true)).toBe(false);
  });

  it("counts a show set to Watching as started, even before an episode", () => {
    const begun = { ...base, episodes_watched: 0 };
    expect(hasStarted(begun)).toBe(true);
    expect(offersNextCheck(begun, true)).toBe(true);
  });

  it("offers the check only on your own profile, and only with an aired episode left", () => {
    expect(offersNextCheck(base, true)).toBe(true);
    expect(offersNextCheck(base, false)).toBe(false);
    expect(offersNextCheck({ ...base, caught_up: true }, true)).toBe(false);
    expect(offersNextCheck({ ...base, all_complete: true }, true)).toBe(false);
  });

  it("logged as a whole with no episodes is still a watched show, not an unstarted one", () => {
    expect(seriesLine({ ...base, episodes_watched: 0, tv_status: "watched" })).toBe("Watched · 10 episodes");
  });
});
