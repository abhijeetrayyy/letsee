import { describe, expect, it } from "vitest";
import {
  basedOnGlance,
  collectionGlance,
  compactCount,
  creditsGlance,
  filmLengthGlance,
  formatMoney,
  humanHours,
  languageGlance,
  moneyGlance,
  nightsPhrase,
  ratingGlance,
  seasonRuntimes,
  seriesSizeGlance,
  seriesStatusGlance,
  seasonTime,
  seriesTimeGlance,
  shortDate,
  themes,
} from "@/utils/title/glance";

describe("is it good", () => {
  it("says what a score means, with how many people gave it", () => {
    expect(ratingGlance(8.5, 34212)).toMatchObject({ lead: "8.5", unit: "/10", note: "Widely loved · 34K votes on TMDB" });
    expect(ratingGlance(7.2, 980)?.note).toBe("Well liked · 980 votes on TMDB");
    expect(ratingGlance(6.4, 4210)?.note).toBe("Mixed reactions · 4.2K votes on TMDB");
    expect(ratingGlance(5.1, 1200)?.note).toBe("Mostly disliked · 1.2K votes on TMDB");
  });
  it("won't call a handful of votes a reputation", () => {
    expect(ratingGlance(10, 3)?.note).toBe("Only 3 votes on TMDB so far");
    expect(ratingGlance(9, 1)?.note).toBe("Only 1 vote on TMDB so far");
  });
  it("is absent with no votes", () => {
    expect(ratingGlance(0, 0)).toBeNull();
    expect(ratingGlance(null, null)).toBeNull();
  });
});

describe("how long", () => {
  it("gives a film's length and, once the clock is known, when it ends", () => {
    expect(filmLengthGlance(152, null)).toMatchObject({ lead: "2h 32m", note: null });
    expect(filmLengthGlance(152, "11:04 pm")?.note).toBe("Ends at 11:04 pm if you start now");
    expect(filmLengthGlance(0, null)).toBeNull();
  });
  it("speaks hours and nights like a person", () => {
    expect(humanHours(45)).toBe("45 min");
    expect(humanHours(65)).toBe("1 hour");
    expect(humanHours(2940)).toBe("49 hours");
    expect(humanHours(28320)).toBe("472 hours");
    expect(nightsPhrase(7)).toBe("7 nights");
    expect(nightsPhrase(62)).toBe("2 months");
    expect(nightsPhrase(42)).toBe("6 weeks");
    expect(nightsPhrase(1180)).toBe("3 years");
  });
  it("counts compactly", () => {
    expect(compactCount(980)).toBe("980");
    expect(compactCount(4210)).toBe("4.2K");
    expect(compactCount(34212)).toBe("34K");
    expect(compactCount(1_250_000)).toBe("1.3M");
  });
});

describe("money", () => {
  it("is the ratio, never a profit", () => {
    expect(moneyGlance(185_000_000, 1_004_558_444)).toMatchObject({ label: "Box office", lead: "$1B", note: "5.4× its $185M budget" });
    expect(moneyGlance(11_363_000, 257_591_776)?.note).toBe("23× its $11M budget");
    expect(moneyGlance(25_000_000, 28_341_469)?.note).toBe("1.1× its $25M budget");
    expect(moneyGlance(100_000_000, 40_000_000)?.note).toBe("Less than its $100M budget");
  });
  it("says only what it has", () => {
    expect(moneyGlance(0, 5_000_000)).toMatchObject({ label: "Box office", note: "Worldwide" });
    expect(moneyGlance(69_000_000, 0)).toMatchObject({ label: "Budget", lead: "$69M" });
    expect(moneyGlance(0, 0)).toBeNull();
    expect(formatMoney(450_000)).toBe("$450K");
  });
});

describe("where it comes from", () => {
  const kw = (...ids: number[]) => ids.map((id) => ({ id, name: String(id) }));
  it("names the source, preferring a true story to the book it became", () => {
    expect(basedOnGlance(kw(9717, 4426))?.lead).toBe("A comic");
    expect(basedOnGlance(kw(818, 9672))?.lead).toBe("A true story");
    expect(basedOnGlance(kw(13141))?.lead).toBe("A manga");
    expect(basedOnGlance(kw(4426))).toBeNull();
  });
  it("tells you to stay for the credits", () => {
    expect(creditsGlance(kw(179430, 179431))?.note).toBe("Scenes during and after them");
    expect(creditsGlance(kw(179431))?.note).toBe("There's a scene during them");
    expect(creditsGlance(kw(1))).toBeNull();
  });
  it("names the language only when it isn't English", () => {
    expect(languageGlance("en", [], ["United States"])).toBeNull();
    expect(languageGlance("ko", [{ iso_639_1: "ko", english_name: "Korean" }], ["South Korea"])).toMatchObject({ lead: "Korean", note: "Made in South Korea" });
    expect(languageGlance("ja", [], [])).toMatchObject({ lead: "Japanese", note: null });
  });
  it("keeps catalogue bookkeeping out of the themes", () => {
    const list = [
      { id: 4426, name: "sadism" },
      { id: 9717, name: "based on comic" },
      { id: 179430, name: "aftercreditsstinger" },
      { id: 9663, name: "sequel" },
      { id: 7002, name: "vigilante" },
    ];
    expect(themes(list).map((k) => k.name)).toEqual(["sadism", "vigilante"]);
    expect(themes(list, 1)).toHaveLength(1);
  });
});

describe("watch order", () => {
  const parts = [
    { id: 272, title: "Batman Begins" },
    { id: 155, title: "The Dark Knight" },
    { id: 49026, title: "The Dark Knight Rises" },
  ];
  it("places the film in its collection", () => {
    expect(collectionGlance("The Dark Knight Collection", parts, 155)).toMatchObject({ lead: "Part 2 of 3", note: "After Batman Begins", href: "#collection" });
    expect(collectionGlance("The Dark Knight Collection", parts, "272")?.note).toBe("The first of The Dark Knight");
  });
  it("holds its place while the parts load, and steps aside for a collection of one", () => {
    expect(collectionGlance("The Dark Knight Collection", null, 155)).toMatchObject({ lead: "Part of a series", note: "The Dark Knight" });
    expect(collectionGlance("X Collection", [{ id: 1, title: "X" }], 1)).toBeNull();
    expect(collectionGlance(null, parts, 155)).toBeNull();
  });
});

describe("a series", () => {
  const eps = (n: number, runtime: number | null) => Array.from({ length: n }, (_, i) => ({ episode_number: i + 1, runtime }));

  it("adds up aired episodes, filling gaps with the season's average", () => {
    const rows = seasonRuntimes(
      [
        { s: 1, count: 3, episodes: [{ episode_number: 1, runtime: 50 }, { episode_number: 2, runtime: null }, { episode_number: 3, runtime: 40 }] },
        { s: 2, count: 4, episodes: eps(4, 60) },
      ],
      { s: 2, e: 2 },
    );
    expect(rows).toEqual([
      { s: 1, aired: 3, minutes: 135 },
      { s: 2, aired: 2, minutes: 120 },
    ]);
  });
  it("borrows the show's average for a season it couldn't load", () => {
    const rows = seasonRuntimes(
      [
        { s: 1, count: 2, episodes: eps(2, 30) },
        { s: 2, count: 2, episodes: null },
      ],
      { s: 2, e: 2 },
    );
    expect(rows?.[1]).toEqual({ s: 2, aired: 2, minutes: 60 });
  });
  it("says nothing when no runtime is known, or nothing has aired", () => {
    expect(seasonRuntimes([{ s: 1, count: 2, episodes: eps(2, null) }], { s: 1, e: 2 })).toBeNull();
    expect(seasonRuntimes([{ s: 1, count: 2, episodes: eps(2, 30) }], null)).toBeNull();
  });

  const bb = [
    { s: 1, aired: 7, minutes: 7 * 47 },
    { s: 2, aired: 13, minutes: 13 * 47 },
  ];
  it("says how long the whole thing takes", () => {
    expect(seriesTimeGlance(bb, null)).toMatchObject({ label: "To watch it all", lead: "16 hours", note: "Or 3 weeks at one a night" });
    expect(seriesSizeGlance(2, 20, bb)).toMatchObject({ lead: "20", note: "2 seasons · about 47 min each" });
  });
  it("or how long you have left, or that you've done it", () => {
    const some = new Set(["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7", "2:1"]);
    expect(seriesTimeGlance(bb, some)).toMatchObject({ label: "Time left", lead: "9 hours", note: "12 episodes to go" });
    const all = new Set([...Array.from({ length: 7 }, (_, i) => `1:${i + 1}`), ...Array.from({ length: 13 }, (_, i) => `2:${i + 1}`)]);
    expect(seriesTimeGlance(bb, all)).toMatchObject({ label: "Time spent", note: "All 20 episodes, watched" });
  });

  const today = { y: 2026, m: 10, d: 4 };
  it("counts down to the next episode once it knows today", () => {
    const next = { season_number: 3, episode_number: 5, name: "The Long Night", air_date: "2026-10-10" };
    expect(seriesStatusGlance({ next, today })).toMatchObject({ label: "Next episode", lead: "In 6 days", note: "S03E05 · The Long Night · Sat 10 Oct" });
    expect(seriesStatusGlance({ next, today: null })).toMatchObject({ lead: "Sat 10 Oct", note: "S03E05 · The Long Night" });
    expect(seriesStatusGlance({ next: { ...next, air_date: "2026-10-05", name: "Episode 5" }, today })).toMatchObject({ lead: "Tomorrow", note: "S03E05" });
    expect(seriesStatusGlance({ next: { ...next, air_date: "2027-01-20" }, today })?.lead).toBe("20 Jan 2027");
  });
  it("says a show is coming back even without a date", () => {
    const last = { season_number: 2, episode_number: 8, air_date: "2024-08-04" };
    expect(seriesStatusGlance({ status: "Returning Series", last, today })).toMatchObject({ lead: "Returning", note: "No date yet · last aired 4 Aug 2024" });
  });
  it("says how a finished show ended", () => {
    const last = { season_number: 5, episode_number: 16, name: "Felina", air_date: "2013-09-29" };
    expect(seriesStatusGlance({ status: "Ended", last, network: "AMC", seasons: 5, today })).toMatchObject({ lead: "Ended", note: "In 2013 on AMC, after 5 seasons" });
    expect(seriesStatusGlance({ status: "Canceled", last, seasons: 1, today })).toMatchObject({ lead: "Cancelled", note: "In 2013, after 1 season" });
    expect(seriesStatusGlance({ status: "Ended", today })).toBeNull();
  });
  it("dates without a timezone", () => {
    expect(shortDate({ y: 2013, m: 9, d: 29 })).toBe("Sun 29 Sep");
    expect(shortDate({ y: 2013, m: 9, d: 29 }, true)).toBe("29 Sep 2013");
  });
});

describe("a season's length", () => {
  it("adds runtimes, filling gaps with the average, and says what's left", () => {
    const eps = [
      { episode_number: 1, runtime: 60 },
      { episode_number: 2, runtime: null },
      { episode_number: 3, runtime: 40 },
    ];
    expect(seasonTime(eps, (n) => n === 1)).toEqual({ total: 150, left: 90 });
    expect(seasonTime([{ episode_number: 1, runtime: null }], () => false)).toBeNull();
  });
});
