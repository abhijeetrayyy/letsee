import { describe, expect, it } from "vitest";
import { linkState } from "@/lib/people/linkState";

const now = Date.UTC(2026, 9, 3, 12);
const inDays = (d: number) => new Date(now + d * 864e5).toISOString();

describe("a link you sent", () => {
  it("is live, with how often it was opened and how long it has", () => {
    expect(linkState({ expiresAt: inDays(29.5), revokedAt: null, opened: 0 }, now)).toEqual({ live: true, line: "Not opened yet · 30 days left" });
    expect(linkState({ expiresAt: inDays(0.5), revokedAt: null, opened: 1 }, now)).toEqual({ live: true, line: "Opened once · 1 day left" });
    expect(linkState({ expiresAt: inDays(3), revokedAt: null, opened: 4 }, now).line).toBe("Opened 4 times · 3 days left");
  });

  it("says when it ran out or was stopped", () => {
    expect(linkState({ expiresAt: inDays(-1), revokedAt: null, opened: 2 }, now)).toEqual({ live: false, line: "Ran out · opened 2 times" });
    expect(linkState({ expiresAt: inDays(5), revokedAt: inDays(-1), opened: 0 }, now)).toEqual({ live: false, line: "Stopped · not opened yet" });
  });
});
