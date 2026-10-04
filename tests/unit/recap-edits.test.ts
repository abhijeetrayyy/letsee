import { describe, expect, it } from "vitest";
import { chosenFilms, cleanLine, shows, startEdits, toggleSection, togglePoster, MAX_LINE } from "@/lib/people/recapEdits";

const pool = ["movie:1", "movie:2", "tv:3", "movie:4", "movie:5", "tv:6"].map((k) => {
  const [itemType, itemId] = k.split(":");
  return { itemType, itemId, itemName: k };
});

describe("editing a recap before you share it", () => {
  it("starts with the four best and nothing hidden", () => {
    const e = startEdits(pool.map((f) => `${f.itemType}:${f.itemId}`));
    expect(e.posters).toEqual(["movie:1", "movie:2", "tv:3", "movie:4"]);
    expect(e.hidden).toEqual([]);
    expect(e.line).toBe("");
  });

  it("takes a poster off, and puts one on at the end", () => {
    let e = startEdits(["movie:1", "movie:2", "tv:3", "movie:4"]);
    e = togglePoster(e, "movie:2");
    expect(e.posters).toEqual(["movie:1", "tv:3", "movie:4"]);
    e = togglePoster(e, "tv:6");
    expect(e.posters).toEqual(["movie:1", "tv:3", "movie:4", "tv:6"]);
  });

  it("never holds more than four", () => {
    const e = startEdits(["movie:1", "movie:2", "tv:3", "movie:4"]);
    expect(togglePoster(e, "movie:5")).toBe(e);
  });

  it("hides and shows a part", () => {
    let e = startEdits([]);
    e = toggleSection(e, "genres");
    expect(shows(e, "genres")).toBe(false);
    expect(shows(e, "stats")).toBe(true);
    e = toggleSection(e, "genres");
    expect(shows(e, "genres")).toBe(true);
  });

  it("keeps your line to one short line", () => {
    expect(cleanLine("  My   year\n in film ")).toBe("My year in film ");
    expect(cleanLine("x".repeat(200))).toHaveLength(MAX_LINE);
  });

  it("gives the chosen films back in your order and drops any that left the pool", () => {
    const e = { line: "", posters: ["tv:6", "movie:1", "movie:99"], hidden: [] };
    expect(chosenFilms(pool, e).map((f) => f.itemName)).toEqual(["tv:6", "movie:1"]);
  });
});
