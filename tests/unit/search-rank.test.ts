import { describe, expect, it } from "vitest";
import { rankByName } from "@/lib/search/rank";

const t = (itemName: string) => ({ itemName });

describe("search ranks what you typed first", () => {
  it("puts exact names above fuzzy guesses, keeping source order within a group", () => {
    const ranked = rankByName([t("Fast Five"), t("Past Lives"), t("Lives of Others"), t("Past Lives Remix"), t("past lives")], "past lives");
    expect(ranked.map((x) => x.itemName)).toEqual(["Past Lives", "past lives", "Past Lives Remix", "Fast Five", "Lives of Others"]);
  });

  it("ignores case and accents the way the index does", () => {
    expect(rankByName([t("Amelie 2"), t("Amélie")], "amelie").map((x) => x.itemName)).toEqual(["Amélie", "Amelie 2"]);
  });
});
