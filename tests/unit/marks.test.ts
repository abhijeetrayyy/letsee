import { describe, expect, it } from "vitest";
import { marksFor, saidAfter, tapOf, type MarkState } from "@/lib/logging/marks";

const film = (over: Partial<MarkState> = {}): MarkState => ({ kind: "movie", status: null, favourite: false, logged: false, ...over });
const show = (over: Partial<MarkState> = {}): MarkState => ({ kind: "tv", status: null, favourite: false, logged: false, ...over });
const labels = (s: MarkState) => marksFor(s).map((m) => `${m.label}${m.on ? "*" : ""}${m.disabled ? "(x)" : ""}`);

describe("marks for a film", () => {
  it("are Watched, Watching, Watch later and Favourite", () => {
    expect(labels(film())).toEqual(["Watched", "Watching", "Watch later", "Favourite"]);
  });

  it("can't be saved for later once watched or started, by mark or by diary", () => {
    expect(labels(film({ status: "watched" }))).toEqual(["Watched*", "Watching", "Watch later(x)", "Favourite"]);
    expect(labels(film({ logged: true }))).toEqual(["Watched*", "Watching", "Watch later(x)", "Favourite"]);
    expect(labels(film({ status: "watching" }))).toEqual(["Watched", "Watching*", "Watch later(x)", "Favourite"]);
  });

  it("show Watch later on, and still tappable, while saved", () => {
    expect(labels(film({ status: "watchlist" }))).toEqual(["Watched", "Watching", "Watch later*", "Favourite"]);
  });

  it("taps: watching a film on and off, and from there to watched", () => {
    expect(tapOf(film(), "watching")).toEqual({ do: "status", status: "watching", dated: false });
    expect(tapOf(film({ status: "watching" }), "watching")).toEqual({ do: "status", status: null, dated: false });
    expect(tapOf(film({ status: "watching" }), "watched")).toEqual({ do: "status", status: "watched", dated: false });
    expect(tapOf(film({ status: "on_hold" }), "watching")).toEqual({ do: "status", status: "watching", dated: false });
  });

  it("taps: watched is a dateless mark, and comes off unless it's in the diary", () => {
    expect(tapOf(film(), "watched")).toEqual({ do: "status", status: "watched", dated: false });
    expect(tapOf(film({ status: "watched" }), "watched")).toEqual({ do: "status", status: null, dated: false });
    expect(tapOf(film({ status: "watched", logged: true }), "watched")).toEqual({ do: "logged" });
  });

  it("taps: watch later on and off, refused once watched; favourite flips", () => {
    expect(tapOf(film(), "later")).toEqual({ do: "status", status: "watchlist", dated: false });
    expect(tapOf(film({ status: "watchlist" }), "later")).toEqual({ do: "status", status: null, dated: false });
    expect(tapOf(film({ status: "watched" }), "later")).toEqual({ do: "nothing" });
    expect(tapOf(film(), "favourite")).toEqual({ do: "favourite", on: true });
    expect(tapOf(film({ favourite: true }), "favourite")).toEqual({ do: "favourite", on: false });
  });
});

describe("marks for a series", () => {
  it("are Watching, Finished, Watch later and Favourite", () => {
    expect(labels(show())).toEqual(["Watching", "Finished", "Watch later", "Favourite"]);
    expect(labels(show({ status: "watching" }))).toEqual(["Watching*", "Finished", "Watch later(x)", "Favourite"]);
    expect(labels(show({ status: "on_hold" }))).toEqual(["Stopped*", "Finished", "Watch later(x)", "Favourite"]);
    expect(labels(show({ status: "watched" }))).toEqual(["Watching", "Finished*", "Watch later(x)", "Favourite"]);
  });

  it("taps: finishing marks every episode; un-finishing goes back to watching; stopped resumes", () => {
    expect(tapOf(show({ status: "watching" }), "finished")).toEqual({ do: "finish" });
    expect(tapOf(show({ status: "watched" }), "finished")).toEqual({ do: "status", status: "watching", dated: false });
    expect(tapOf(show({ status: "on_hold" }), "watching")).toEqual({ do: "status", status: "watching", dated: false });
    expect(tapOf(show({ status: "watching" }), "watching")).toEqual({ do: "status", status: null, dated: false });
    expect(tapOf(show(), "watching")).toEqual({ do: "status", status: "watching", dated: false });
  });

  it("says what happened", () => {
    expect(saidAfter("finished", true, "tv")).toMatch(/every episode/);
    expect(saidAfter("later", true, "movie")).toBe("Added to Watch later");
  });
});
