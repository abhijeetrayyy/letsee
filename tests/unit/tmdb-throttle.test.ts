import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The TMDB throttle (utils/tmdbClient). Its old scheduler let one waiting
 * request through and then stopped until another finished, so bursts meant to
 * run eight at a time ran nearly one by one — a person page's fifteen calls in
 * series (measured 25 Oct 2026). Real timers: these are about time.
 */
describe("the TMDB throttle", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TMDB_READ_TOKEN = "test-token";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TMDB_READ_TOKEN;
  });

  it("runs a burst up to eight at a time, a short gap apart — not one by one", async () => {
    let active = 0;
    let most = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        active++;
        most = Math.max(most, active);
        await new Promise((r) => setTimeout(r, 300));
        active--;
        return new Response("{}", { status: 200 });
      }),
    );
    const { fetchTmdb } = await import("@/utils/tmdbClient");
    const started = Date.now();
    const all = await Promise.all(Array.from({ length: 16 }, (_, i) => fetchTmdb(`https://api.themoviedb.org/3/movie/${i}`, { cache: "no-store" })));
    const took = Date.now() - started;

    expect(all.every((r) => r.ok)).toBe(true);
    // Never more than eight at once (the old one let all sixteen start together), and really eight.
    expect(most).toBeLessThanOrEqual(8);
    expect(most).toBeGreaterThanOrEqual(7);
    // Two rounds of eight, ~300ms each, plus the gaps: well under a second. One at a time would be 4.8s.
    expect(took).toBeLessThan(1500);
  });

  it("gives up on a stalled request within its limit, instead of the old ~38 seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))),
      ),
    );
    const { fetchTmdb } = await import("@/utils/tmdbClient");
    const started = Date.now();
    await expect(fetchTmdb("https://api.themoviedb.org/3/movie/1", { cache: "no-store", timeoutMs: 60, maxAttempts: 1 })).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("tries a dropped connection again, but stops after a second timeout", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        if (calls < 3) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
        return new Response("{}", { status: 200 });
      }),
    );
    const { fetchTmdb } = await import("@/utils/tmdbClient");
    expect((await fetchTmdb("https://api.themoviedb.org/3/person/1100", { cache: "no-store" })).ok).toBe(true);
    expect(calls).toBe(3);

    vi.resetModules();
    let stalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        stalls++;
        return new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
      }),
    );
    const again = await import("@/utils/tmdbClient");
    await expect(again.fetchTmdb("https://api.themoviedb.org/3/person/1100", { cache: "no-store", timeoutMs: 40 })).rejects.toThrow();
    expect(stalls).toBe(2);
  });
});
