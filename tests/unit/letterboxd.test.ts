import { describe, expect, it } from "vitest";
import { parseCsv, convertRating } from "@/utils/letterboxd";

/**
 * The CSV scanner is hand-rolled, and its own comment says why: a Letterboxd
 * review legitimately contains commas, quotes and newlines, so splitting on
 * lines first silently corrupts every multi-paragraph review in the file.
 *
 * "Silently" is the word that makes this worth testing. A broken parser here
 * does not throw — it imports someone's five years of writing with the middle
 * cut out, and nothing anywhere reports a problem.
 */
describe("parseCsv", () => {
  it("keeps a newline inside a quoted review instead of ending the record", () => {
    const csv = 'Name,Review\n"Heat","First paragraph.\n\nSecond paragraph."\n';
    const rows = parseCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("Heat");
    expect(rows[1][1]).toBe("First paragraph.\n\nSecond paragraph.");
  });

  it("keeps a comma inside a quoted field", () => {
    expect(parseCsv('Name,Review\n"Amélie","Warm, odd, and kind."\n')[1]).toEqual([
      "Amélie",
      "Warm, odd, and kind.",
    ]);
  });

  it("unescapes a doubled quote to a single one", () => {
    expect(parseCsv('Name,Review\n"Alien","They call it ""perfect organism""."\n')[1][1]).toBe(
      'They call it "perfect organism".',
    );
  });

  it("treats CRLF as one terminator, not two blank records", () => {
    expect(parseCsv("Name,Year\r\nHeat,1995\r\nDrive,2011\r\n")).toHaveLength(3);
  });

  it("keeps the final record when the file does not end in a newline", () => {
    const rows = parseCsv("Name,Year\nHeat,1995");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["Heat", "1995"]);
  });

  it("strips the UTF-8 BOM Letterboxd writes, so the first header is usable", () => {
    // Without this the first column name is "﻿Name" and every lookup misses.
    expect(parseCsv("﻿Name,Year\nHeat,1995")[0][0]).toBe("Name");
  });

  it("drops blank records without dropping records that are merely sparse", () => {
    const rows = parseCsv("Name,Year\nHeat,1995\n\n,\nDrive,\n");
    expect(rows.map((r) => r[0])).toEqual(["Name", "Heat", "Drive"]);
  });
});

/**
 * Letterboxd rates 0.5–5.0 in half steps; this app stores 1–10 integers.
 * Doubling is exact in both directions, which is the only reason the two
 * scales can be reconciled without losing anything.
 */
describe("convertRating", () => {
  it("doubles a half-star scale onto the stored 1–10 scale", () => {
    expect(convertRating("0.5")).toBe(1);
    expect(convertRating("2.5")).toBe(5);
    expect(convertRating("5")).toBe(10);
  });

  it("returns null rather than 0 for an unrated row", () => {
    // 0 is a real score in no scale here; treating it as one would seed the
    // community histogram with ratings nobody gave.
    for (const raw of [undefined, "", "0", "-1", "not a number"]) {
      expect(convertRating(raw)).toBeNull();
    }
  });

  it("refuses a value outside the scale rather than clamping into it", () => {
    expect(convertRating("6")).toBeNull();
    expect(convertRating("99")).toBeNull();
  });
});
