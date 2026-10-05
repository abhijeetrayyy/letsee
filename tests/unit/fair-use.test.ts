import { beforeEach, describe, expect, it, vi } from "vitest";

// guard.ts reads request headers through next/headers only when no request is
// passed; check() is what's tested here, so that import is stubbed.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { BUCKETS, check, clientKey, hashKey, resetLimits, tooFastMessage } = await import("@/lib/limits/guard");

describe("fair use: check()", () => {
  beforeEach(() => resetLimits());

  it("lets ordinary use through, and stops at the bucket's limit", () => {
    const t = 1_000_000;
    for (let i = 0; i < BUCKETS.people.limit; i++) expect(check("1.1.1.1", "people", t + i).ok).toBe(true);
    const over = check("1.1.1.1", "people", t + 100);
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.penalty).toBe(false);
      expect(over.retryAfter).toBeGreaterThan(0);
    }
  });

  it("counts each address, and each bucket, on its own", () => {
    const t = 2_000_000;
    for (let i = 0; i < BUCKETS.people.limit; i++) check("2.2.2.2", "people", t);
    expect(check("2.2.2.2", "people", t).ok).toBe(false);
    expect(check("3.3.3.3", "people", t).ok).toBe(true);
    expect(check("2.2.2.2", "tmdb", t).ok).toBe(true);
  });

  it("forgets after the window", () => {
    const t = 3_000_000;
    for (let i = 0; i < BUCKETS.people.limit; i++) check("4.4.4.4", "people", t);
    expect(check("4.4.4.4", "people", t + 1).ok).toBe(false);
    expect(check("4.4.4.4", "people", t + BUCKETS.people.windowMs + 1).ok).toBe(true);
  });

  it("a few taps too many is a refusal, not a pause", () => {
    const t = 3_500_000;
    const key = "6.6.6.6";
    for (let i = 0; i < BUCKETS.people.limit + 10; i++) check(key, "people", t + i);
    const v = check(key, "people", t + 20);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.penalty).toBe(false);
  });

  it("going over in three separate minutes is a ten-minute pause, across every bucket, logged once", () => {
    const t = 4_000_000;
    const key = "5.5.5.5";
    const minute = BUCKETS.people.windowMs + 1;
    let verdict = check(key, "people", t);
    for (let round = 0; round < 3; round++) {
      const at = t + round * minute;
      for (let i = 0; i <= BUCKETS.people.limit; i++) verdict = check(key, "people", at + i);
      if (round < 2) expect(!verdict.ok && verdict.penalty).toBe(false);
    }
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.penalty).toBe(true);
      expect(verdict.started).toBe(true);
    }
    const later = check(key, "tmdb", t + 2 * minute + 5000);
    expect(later.ok).toBe(false);
    if (!later.ok) expect(later.started).toBe(false);
    expect(check(key, "tmdb", t + 2 * minute + 11 * 60_000).ok).toBe(true);
  });

  it("keys by Vercel's address, and never logs it in the clear", () => {
    expect(clientKey(new Headers({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "8.8.8.8, 7.7.7.7" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers({ "x-forwarded-for": "8.8.8.8, 7.7.7.7" }))).toBe("8.8.8.8");
    expect(hashKey("9.9.9.9")).toMatch(/^[0-9a-f]{16}$/);
    expect(hashKey("9.9.9.9")).not.toContain("9.9.9.9");
  });

  it("says how long to wait, in words", () => {
    expect(tooFastMessage({ ok: false, retryAfter: 30, penalty: false, started: false, bucket: "tmdb" })).toMatch(/30 seconds/);
    expect(tooFastMessage({ ok: false, retryAfter: 600, penalty: true, started: true, bucket: "tmdb" })).toMatch(/10 minutes/);
  });
});
