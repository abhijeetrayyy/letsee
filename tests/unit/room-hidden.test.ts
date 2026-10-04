import { describe, expect, it } from "vitest";
import { eventRef, hiddenKey, withoutHidden } from "@/lib/rooms/hidden";

const items = [
  { kind: "message" as const, message: { id: "a1b2" } },
  { kind: "together" as const, together: { viewingId: 42 } },
  { kind: "pass" as const, pass: { id: 7 } },
];

describe("hiding things in a room", () => {
  it("keys each kind of event by its own id", () => {
    expect(eventRef(items[0])).toEqual({ kind: "message", id: "a1b2" });
    expect(eventRef(items[1])).toEqual({ kind: "together", id: "42" });
    expect(eventRef(items[2])).toEqual({ kind: "pass", id: "7" });
  });

  it("leaves out exactly what you hid and says how many", () => {
    const { shown, hiddenCount } = withoutHidden(items, new Set([hiddenKey("together", 42), hiddenKey("pass", 99)]));
    expect(shown.map((i) => i.kind)).toEqual(["message", "pass"]);
    expect(hiddenCount).toBe(1);
  });

  it("never confuses a pass and a viewing with the same number", () => {
    const { shown } = withoutHidden([{ kind: "pass" as const, pass: { id: 42 } }, ...items], new Set([hiddenKey("together", 42)]));
    expect(shown.some((i) => i.kind === "pass" && i.pass.id === 42)).toBe(true);
  });
});
