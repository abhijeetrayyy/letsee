import { describe, expect, it } from "vitest";
import { normaliseDate, parseCompanions, todayIso } from "@/utils/viewings";
import { monthBounds, previousMonth } from "@/utils/monthInReview";
import { detectSource, parseImdbExport, parseNetflixExport, splitNetflixTitle } from "@/utils/importSources";
import { parseLetterboxdExport } from "@/utils/letterboxd";

const enc = new TextEncoder();

/**
 * A viewing is a date. The date is the product, so the date parsing is the
 * part that must not be wrong: it refuses the future, refuses nonsense, and
 * round-trips exactly what it accepts.
 */
describe("a viewing's date", () => {
  it("accepts yyyy-mm-dd and nothing looser", () => {
    expect(normaliseDate("2024-02-29")).toBe("2024-02-29");
    expect(normaliseDate("2023-02-29")).toBeNull(); // not a leap year
    expect(normaliseDate("2024-13-01")).toBeNull();
    expect(normaliseDate("24-01-01")).toBeNull();
    expect(normaliseDate("2024-01-01T10:00:00Z")).toBeNull();
    expect(normaliseDate(20240101)).toBeNull();
  });

  it("refuses the future, allowing for the day being ahead somewhere", () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 3);
    expect(normaliseDate(future.toISOString().slice(0, 10))).toBeNull();
    expect(normaliseDate(todayIso())).toBe(todayIso());
  });
});

describe("companions on a viewing", () => {
  it("keeps one entry per person, users and names alike, and trims names", () => {
    const list = parseCompanions([
      { userId: "u1" },
      { userId: "u1" },
      { name: "  Priya " },
      { name: "priya" },
      { name: "" },
      "junk",
      { userId: 5 },
    ]);
    expect(list).toEqual([{ userId: "u1" }, { name: "Priya" }]);
  });

  it("caps the list, because a viewing is a room and not a stadium", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `p${i}` }));
    expect(parseCompanions(many)).toHaveLength(12);
  });
});

describe("a month", () => {
  it("knows its own bounds, including February", () => {
    expect(monthBounds("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29", label: "February 2024" });
    expect(monthBounds("2025-02")?.end).toBe("2025-02-28");
    expect(monthBounds("2025-13")).toBeNull();
    expect(monthBounds("nope")).toBeNull();
  });

  it("names the previous month across a year boundary", () => {
    expect(previousMonth(new Date(2026, 0, 15))).toBe("2025-12");
    expect(previousMonth(new Date(2026, 8, 11))).toBe("2026-08");
  });
});

/**
 * Netflix's export is a title and a date, and the title is the whole
 * structure: "Show: Season 2: Episode name". Everything downstream depends
 * on that split being right.
 */
describe("Netflix titles", () => {
  it("splits show, season and episode", () => {
    expect(splitNetflixTitle('Breaking Bad: Season 4: "Bullet Points"')).toEqual({
      show: "Breaking Bad",
      season: 4,
      episode: '"Bullet Points"',
    });
    expect(splitNetflixTitle("The Queen's Gambit: Limited Series: Openings")).toEqual({
      show: "The Queen's Gambit",
      season: 1,
      episode: "Openings",
    });
    expect(splitNetflixTitle("Stranger Things: Part 2: The Vanishing")).toMatchObject({ show: "Stranger Things", season: 2 });
  });

  it("leaves a film alone", () => {
    expect(splitNetflixTitle("Past Lives")).toBeNull();
    expect(splitNetflixTitle("Mission: Impossible")).toBeNull();
  });

  it("turns a viewing activity file into series with named episodes and dated films", () => {
    const csv = [
      "Title,Date",
      '"Breaking Bad: Season 1: Pilot","1/2/2021"',
      '"Breaking Bad: Season 1: Cat\'s in the Bag...","1/3/2021"',
      '"Past Lives","6/10/2024"',
      '"Past Lives","12/25/2024"',
    ].join("\n");
    const { records } = parseNetflixExport(enc.encode(csv), "NetflixViewingHistory.csv");
    const show = records.find((r) => r.title === "Breaking Bad");
    const film = records.find((r) => r.title === "Past Lives");
    expect(show?.mediaHint).toBe("tv");
    expect(show?.episodes).toHaveLength(2);
    expect(show?.episodes?.[0]).toMatchObject({ s: 1, e: 0, name: "Pilot", on: "2021-01-02" });
    expect(film?.mediaHint).toBe("movie");
    expect(film?.watched).toBe(true);
    // Two dated viewings: the rewatch survives.
    expect(film?.viewingDates).toEqual(["2024-06-10", "2024-12-25"]);
  });
});

describe("IMDb", () => {
  it("reads a ratings export by Const and rating, and a watchlist as a watchlist", () => {
    const ratings = ["Const,Your Rating,Date Rated,Title,Title Type,Year", "tt0137523,9,2020-05-01,Fight Club,Movie,1999", "tt0903747,10,2021-01-01,Breaking Bad,TV Series,2008"].join("\n");
    const { records } = parseImdbExport(enc.encode(ratings), "ratings.csv");
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ imdbId: "tt0137523", rating: 9, watched: true, mediaHint: "movie", viewingDates: ["2020-05-01"] });
    expect(records[1]).toMatchObject({ imdbId: "tt0903747", mediaHint: "tv" });

    const watchlist = ["Position,Const,Created,Modified,Description,Title,Title Type,Year", "1,tt1375666,2022-01-01,,,Inception,Movie,2010"].join("\n");
    const wl = parseImdbExport(enc.encode(watchlist), "WATCHLIST.csv");
    expect(wl.records[0]).toMatchObject({ imdbId: "tt1375666", watchlist: true, watched: false });
  });
});

describe("Letterboxd's diary", () => {
  it("keeps every viewing from diary.csv, so a rewatch is a rewatch", () => {
    const csv = [
      "Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date",
      "2024-01-05,Heat,1995,https://boxd.it/x,4.5,,,2024-01-04",
      "2024-08-01,Heat,1995,https://boxd.it/x,5,Yes,,2024-07-31",
    ].join("\n");
    const { records } = parseLetterboxdExport(enc.encode(csv), "diary.csv");
    expect(records).toHaveLength(1);
    expect(records[0].viewingDates).toEqual(["2024-01-04", "2024-07-31"]);
    expect(records[0].watchedDate).toBe("2024-01-04");
    expect(records[0].rating).toBe(9);
  });
});

describe("telling exports apart", () => {
  it("recognises each source from its file", () => {
    expect(detectSource(enc.encode("Const,Your Rating,Date Rated,Title"), "ratings.csv")).toBe("imdb");
    expect(detectSource(enc.encode("Title,Date\nPast Lives,1/1/2024"), "NetflixViewingHistory.csv")).toBe("netflix");
    expect(detectSource(enc.encode("Date,Name,Year,Letterboxd URI"), "watched.csv")).toBe("letterboxd");
    expect(detectSource(enc.encode('[{"movie":{"title":"Heat"}}]'), "history-1.json")).toBe("trakt");
    expect(detectSource(enc.encode('{"movies":[],"shows":[]}'), "simkl.json")).toBe("simkl");
    expect(detectSource(enc.encode("series_name,season_number,episode_number,watched_at"), "tracking-prod-records-v2.csv")).toBe("tvtime");
  });
});
