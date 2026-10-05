import { describe, expect, it } from "vitest";
import { localDay, mergeLately, type LatelyLog } from "@/lib/people/lately";

const log = (id: number, itemId: string, day: string, at: string, over: Partial<LatelyLog> = {}): LatelyLog => ({
  kind: "log",
  id,
  itemId,
  itemType: "movie",
  itemName: `Film ${itemId}`,
  imageUrl: null,
  day,
  at,
  rewatch: false,
  who: [],
  ...over,
});
const mark = (itemId: string, at: string, itemType: "movie" | "tv" = "movie") => ({ itemId, itemType, itemName: `Title ${itemId}`, imageUrl: null, at });
const keys = (list: ReturnType<typeof mergeLately>) => list.map((e) => `${e.kind}:${e.itemId}`);

describe("a profile's Lately", () => {
  it("shows titles marked from a poster, which the diary never sees", () => {
    const logs = [log(1, "a", "2026-10-03", "2026-10-03T12:00:00Z")];
    const marks = [mark("b", "2026-10-05T12:00:00Z"), mark("c", "2026-10-05T11:00:00Z", "tv")];
    expect(keys(mergeLately(logs, marks))).toEqual(["mark:b", "mark:c", "log:a"]);
  });

  it("shows a title in both once, as the log", () => {
    const logs = [log(1, "a", localDay("2026-10-05T12:00:00Z"), "2026-10-05T12:00:00Z")];
    expect(keys(mergeLately(logs, [mark("a", "2026-10-05T12:00:01Z")]))).toEqual(["log:a"]);
  });

  it("puts a film logged for an earlier day below one marked today", () => {
    const logs = [log(1, "a", "2026-09-28", "2026-10-05T13:00:00Z")];
    expect(keys(mergeLately(logs, [mark("b", "2026-10-05T12:00:00Z")]))).toEqual(["mark:b", "log:a"]);
  });

  it("keeps to the limit and skips rows with no name", () => {
    const marks = ["a", "b", "c", "d", "e", "f", "g"].map((id, n) => mark(id, `2026-10-0${n + 1}T12:00:00Z`));
    marks[6].itemName = "";
    expect(keys(mergeLately([], marks, 3))).toEqual(["mark:f", "mark:e", "mark:d"]);
  });
});
