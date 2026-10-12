import { describe, expect, it } from "vitest";
import { monthLabel, pickRoomMonth, roomMonthLine } from "@/lib/people/ourMonth";

const t = (id: number, watchedOn: string) => ({ viewingId: id, itemId: String(id), itemType: "movie" as const, itemName: `F${id}`, imageUrl: null, watchedOn });
const p = (id: number, at: string, fromMe = false) => ({ id, fromMe, itemName: `P${id}`, imageUrl: null, at });

describe("a room's month", () => {
  const together = [t(1, "2026-09-12"), t(2, "2026-09-20"), t(3, "2026-10-02")];
  const passes = [p(9, "2026-09-25T10:00:00Z"), p(10, "2026-10-10T10:00:00Z", true)];

  it("recaps last month in the first week, if it had anything", () => {
    const m = pickRoomMonth(together, passes, "2026-10-04")!;
    expect(m.month).toBe("2026-09");
    expect(m.films.map((f) => f.viewingId)).toEqual([1, 2]);
    expect(roomMonthLine(m)).toBe("2 films together · 1 passed");
  });

  it("shows this month after the first week, or when last month was empty", () => {
    expect(pickRoomMonth(together, passes, "2026-10-12")!.month).toBe("2026-10");
    expect(pickRoomMonth([t(3, "2026-10-02")], [], "2026-10-04")!.month).toBe("2026-10");
    expect(pickRoomMonth([t(5, "2026-12-30")], [], "2027-01-03")!.month).toBe("2026-12");
  });

  it("is nothing when the month has nothing", () => {
    expect(pickRoomMonth([], [], "2026-10-12")).toBeNull();
  });

  it("names the month", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(roomMonthLine({ month: "2026-10", label: "", films: [t(3, "2026-10-02")], passes: [] })).toBe("1 film together");
  });
});
