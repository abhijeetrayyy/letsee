import { describe, expect, it } from "vitest";
import {
  dayWords,
  hasWatched,
  primaryAction,
  saveAction,
  stateLine,
  statusAfterLog,
  statusChoices,
  statusToRestore,
  statusWord,
  type Kind,
  type Status,
  type TitleState,
} from "@/lib/logging/titleState";

const TODAY = "2026-10-03";
const s = (kind: Kind, status: Status, days: string[] = []): TitleState => ({ kind, status, viewings: days.map((watchedOn) => ({ watchedOn })) });

describe("the five words", () => {
  it("reads every status the way a person would", () => {
    expect(statusWord("watchlist")).toBe("Want to watch");
    expect(statusWord("watching")).toBe("Watching");
    expect(statusWord("watched")).toBe("Watched");
    expect(statusWord("on_hold")).toBe("On hold");
    expect(statusWord("dropped")).toBe("Dropped");
    expect(statusWord(null)).toBeNull();
  });
});

describe("the primary action", () => {
  it("is Log it for anything you have not watched", () => {
    for (const status of [null, "watchlist", "on_hold", "dropped"] as Status[]) {
      expect(primaryAction(s("movie", status)).label).toBe("Log it");
    }
    expect(primaryAction(s("tv", "watching")).label).toBe("Log it");
  });

  it("becomes Log again — a rewatch — once there is a viewing or a watched status", () => {
    expect(primaryAction(s("movie", "watched"))).toEqual({ label: "Log again", rewatch: true });
    // An imported viewing with no status row still counts.
    expect(primaryAction(s("movie", null, ["2025-01-01"]))).toEqual({ label: "Log again", rewatch: true });
    expect(primaryAction(s("tv", "watching", ["2026-09-30"])).label).toBe("Log again");
  });
});

describe("saving to Up next", () => {
  it("is offered before you watch, and shows as saved once saved", () => {
    expect(saveAction(s("movie", null))).toEqual({ show: true, saved: false });
    expect(saveAction(s("movie", "watchlist"))).toEqual({ show: true, saved: true });
    expect(saveAction(s("tv", null))).toEqual({ show: true, saved: false });
  });

  it("goes away once watched, because saving would overwrite watched", () => {
    expect(saveAction(s("movie", "watched")).show).toBe(false);
    expect(saveAction(s("movie", null, ["2026-01-01"])).show).toBe(false);
  });

  it("is not offered for a series already in progress or stopped", () => {
    expect(saveAction(s("tv", "watching")).show).toBe(false);
    expect(saveAction(s("tv", "on_hold")).show).toBe(false);
    expect(saveAction(s("tv", "dropped")).show).toBe(false);
  });

  it("stays offered for a film you stopped, which you might still want to finish", () => {
    expect(saveAction(s("movie", "dropped")).show).toBe(true);
  });
});

describe("statuses you can choose", () => {
  it("never offers Watched — that only comes from logging", () => {
    expect(statusChoices("movie")).not.toContain("watched");
    expect(statusChoices("tv")).not.toContain("watched");
  });

  it("gives a film one state and a series three", () => {
    expect(statusChoices("movie")).toEqual(["watchlist"]);
    expect(statusChoices("tv")).toEqual(["watchlist", "watching", "on_hold"]);
  });
});

describe("what a log does, and what Undo restores", () => {
  it("marks a film watched whatever it was before", () => {
    for (const prev of [null, "watchlist", "on_hold", "dropped", "watched"] as Status[]) {
      expect(statusAfterLog("movie", prev)).toBe("watched");
    }
  });

  it("keeps a series in progress in progress", () => {
    expect(statusAfterLog("tv", "watching")).toBe("watching");
    expect(statusAfterLog("tv", "on_hold")).toBe("on_hold");
    expect(statusAfterLog("tv", "watchlist")).toBe("watched");
    expect(statusAfterLog("tv", null)).toBe("watched");
  });

  it("restores the previous status on Undo, and leaves a rewatch's watched alone", () => {
    expect(statusToRestore("watchlist")).toEqual({ restore: true, status: "watchlist" });
    expect(statusToRestore(null)).toEqual({ restore: true, status: null });
    expect(statusToRestore("watched")).toEqual({ restore: false, status: "watched" });
  });

  it("round-trips: log then undo lands where it started", () => {
    for (const kind of ["movie", "tv"] as Kind[]) {
      for (const prev of [null, "watchlist", "watching", "on_hold", "dropped"] as Status[]) {
        const after = statusAfterLog(kind, prev);
        const undo = statusToRestore(prev);
        const final = undo.restore ? undo.status : after;
        expect(final).toBe(prev);
      }
    }
  });
});

describe("the line that says where you stand", () => {
  it("says nothing when there is nothing", () => {
    expect(stateLine(s("movie", null), TODAY)).toBeNull();
  });

  it("names the status when nothing is logged", () => {
    expect(stateLine(s("movie", "watchlist"), TODAY)).toBe("Want to watch");
    expect(stateLine(s("tv", "on_hold"), TODAY)).toBe("On hold");
    expect(stateLine(s("movie", "dropped"), TODAY)).toBe("Dropped");
  });

  it("says when you watched it, and how often", () => {
    expect(stateLine(s("movie", "watched", ["2026-10-03"]), TODAY)).toBe("Watched today");
    expect(stateLine(s("movie", "watched", ["2026-10-02"]), TODAY)).toBe("Watched yesterday");
    expect(stateLine(s("movie", "watched", ["2026-03-14", "2026-09-26", "2025-12-01"]), TODAY)).toBe("Watched 3 times · last Sat 26 Sept");
  });

  it("does not call a series in progress watched", () => {
    expect(stateLine(s("tv", "watching", ["2026-10-02"]), TODAY)).toBe("Watching · logged yesterday");
  });

  it("dates another year in full", () => {
    expect(dayWords("2024-03-14", TODAY)).toBe("14 Mar 2024");
  });

  it("knows a watched status with no viewing is still watched", () => {
    expect(hasWatched(s("movie", "watched"))).toBe(true);
    expect(stateLine(s("movie", "watched"), TODAY)).toBe("Watched");
  });
});
