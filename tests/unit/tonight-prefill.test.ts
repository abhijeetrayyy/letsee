import { describe, expect, it } from "vitest";
import { prefillIds, readWith, strangersIn, tonightHref, MAX_PREFILL } from "@/lib/people/tonight";

const people = [
  { userId: "a", username: "Priya" },
  { userId: "b", username: "sam" },
];

describe("opening Tonight with people in it", () => {
  it("writes who in the link, once each", () => {
    expect(tonightHref([])).toBe("/app/tonight");
    expect(tonightHref(["priya", "sam", "priya"])).toBe("/app/tonight?with=priya,sam");
  });

  it("reads the link back, ignoring case, blanks and repeats", () => {
    expect(readWith(null)).toEqual([]);
    expect(readWith("Priya,,sam,PRIYA")).toEqual(["priya", "sam"]);
    expect(readWith("%E0%A4,sam")).toEqual(["%e0%a4", "sam"]);
  });

  it("never prefills more than the room holds", () => {
    const many = Array.from({ length: 12 }, (_, i) => `p${i}`);
    expect(readWith(many.join(","))).toHaveLength(MAX_PREFILL);
    expect(tonightHref(many).split(",")).toHaveLength(MAX_PREFILL);
  });

  it("preselects only people you're connected to", () => {
    expect([...prefillIds(people, ["priya", "stranger"])]).toEqual(["a"]);
    expect(prefillIds(people, []).size).toBe(0);
  });
});

describe("who can be brought into a session", () => {
  const me = "me";
  it("lets you bring people you're connected to, and yourself", () => {
    expect(strangersIn(["me", "a"], me, new Set(["a"]))).toEqual([]);
  });

  it("refuses anyone else", () => {
    expect(strangersIn(["me", "a", "x"], me, new Set(["a"]))).toEqual(["x"]);
  });

  it("in a group's session, the group's members count as connected", () => {
    expect(strangersIn(["me", "g1", "g2"], me, new Set(), new Set(["me", "g1", "g2"]))).toEqual([]);
    expect(strangersIn(["me", "g1", "x"], me, new Set(), new Set(["me", "g1"]))).toEqual(["x"]);
  });
});
