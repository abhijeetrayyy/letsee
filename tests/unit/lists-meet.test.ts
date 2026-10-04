import { describe, expect, it } from "vitest";
import { listsMeet, type ListTitle } from "@/lib/people/moments";

const t = (id: string, type: "movie" | "tv" = "movie"): ListTitle => ({ itemId: id, itemType: type, itemName: id, imageUrl: null });

describe("where your lists meet", () => {
  it("puts what you both want first, then what they've seen of yours, then what you've seen of theirs", () => {
    const mine = [t("a"), t("b"), t("c")];
    const theirs = [t("c"), t("d"), t("e")];
    const out = listsMeet(mine, theirs, new Set(["movie:a"]), new Set(["movie:e"]));
    expect(out.map((x) => `${x.kind}:${x.itemId}`)).toEqual(["both:c", "they-saw:a", "you-saw:e"]);
  });
  it("tells a film from a series with the same number", () => {
    expect(listsMeet([t("1", "tv")], [t("1", "movie")], new Set(), new Set())).toEqual([]);
  });
  it("lists a title once, and stops at the cap", () => {
    const mine = [t("a"), t("b")];
    const out = listsMeet(mine, [t("a")], new Set(["movie:a", "movie:b"]), new Set(), 1);
    expect(out.map((x) => x.kind)).toEqual(["both"]);
    expect(listsMeet(mine, [t("a")], new Set(["movie:a"]), new Set()).map((x) => x.itemId)).toEqual(["a"]);
  });
});
