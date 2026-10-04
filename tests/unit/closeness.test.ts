import { describe, expect, it } from "vitest";
import { closeness, isOneOfYourPeople, type ClosenessInput } from "@/lib/people/closeness";

const NOW = new Date("2026-10-03T12:00:00Z").getTime();
const daysAgo = (d: number) => new Date(NOW - d * 864e5).toISOString();
const none: ClosenessInput = { together: 0, lastTogether: null, passes: 0, lastPass: null, lastMessage: null, mutual: false };

describe("closeness", () => {
  it("weighs watching together above passing above talking", () => {
    const watched = closeness({ ...none, together: 1, lastTogether: daysAgo(0) }, NOW);
    const passed = closeness({ ...none, passes: 1, lastPass: daysAgo(0) }, NOW);
    const talked = closeness({ ...none, lastMessage: daysAgo(0) }, NOW);
    expect(watched).toBeGreaterThan(passed);
    expect(passed).toBeGreaterThan(talked);
  });

  it("lets last week's friend outrank one from three years ago", () => {
    const old = closeness({ ...none, together: 20, lastTogether: daysAgo(1100) }, NOW);
    const recent = closeness({ ...none, together: 2, lastTogether: daysAgo(7) }, NOW);
    expect(recent).toBeGreaterThan(old);
  });

  it("halves a part every sixty days", () => {
    const fresh = closeness({ ...none, passes: 1, lastPass: daysAgo(0) }, NOW);
    const later = closeness({ ...none, passes: 1, lastPass: daysAgo(60) }, NOW);
    expect(later).toBeCloseTo(fresh / 2, 5);
  });

  it("forgets a conversation after 180 days but keeps a mutual follow", () => {
    expect(closeness({ ...none, lastMessage: daysAgo(181) }, NOW)).toBe(0);
    expect(isOneOfYourPeople({ ...none, lastMessage: daysAgo(181) }, NOW)).toBe(false);
    expect(isOneOfYourPeople({ ...none, mutual: true }, NOW)).toBe(true);
  });
});
