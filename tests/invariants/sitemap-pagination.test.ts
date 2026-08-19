import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { read, rel, sourceFiles } from "./schema";

/**
 * PostgREST caps a single response at 1000 rows and says nothing about it.
 * `.limit(5000)` returns 1000 with no error, no warning, and a `data` array
 * that looks complete.
 *
 * This file shipped with `MAX_ROWS = 5000` and four queries that trusted it.
 * Nothing looked wrong, because every table involved was under a thousand rows
 * — the truncation would have begun silently at the moment the site grew
 * enough for the sitemap to matter. `watched_episodes` is already at ~9k, so a
 * single unpaginated read of it would list roughly a sixth of the seasons.
 *
 * The failure has no symptom: no exception, no empty page, just a sitemap
 * quietly missing most of the site. That is exactly the kind of rule that gets
 * reintroduced by the next person adding a query here, so it is enforced
 * rather than commented.
 */
describe("sitemap reads past the 1000-row response cap", () => {
  const file = sourceFiles().find((f) => rel(f) === join("src", "app", "sitemap.ts"))!;
  const source = read(file);
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("has a sitemap to check", () => {
    expect(file).toBeTruthy();
  });

  it("paginates every table read", () => {
    // `.from(...)` is how a table read starts; each one must be inside a
    // paged callback, and `.range(` is the only way to ask for a window.
    const reads = code.match(/\.from\(/g) ?? [];
    const ranges = code.match(/\.range\(/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    expect(ranges.length).toBe(reads.length);
  });

  it("never asks for more rows in one request than PostgREST will return", () => {
    // A bare `.limit(n)` with n > 1000 is the silent-truncation bug itself.
    for (const [, n] of code.matchAll(/\.limit\((\d+)\)/g)) {
      expect(Number(n)).toBeLessThanOrEqual(1000);
    }
    expect(/const PAGE = (\d+)/.exec(code)?.[1]).toBeDefined();
    expect(Number(/const PAGE = (\d+)/.exec(code)![1])).toBeLessThanOrEqual(1000);
  });

  it("orders every paged read by a key that cannot tie", () => {
    /**
     * Range pagination over a non-unique sort key duplicates and skips rows.
     * `updated_at` ties constantly here — the bulk quick-add stamps one
     * timestamp across an entire batch — so ordering a paged read by it would
     * reshuffle rows between pages.
     */
    const orders = [...code.matchAll(/\.order\("([^"]+)"/g)].map((m) => m[1]);
    expect(orders.length).toBeGreaterThan(0);
    expect(orders).not.toContain("updated_at");
    expect(orders).not.toContain("watched_at");
  });

  it("lists seasons but not episodes", () => {
    /**
     * Tens of thousands of episode URLs would swamp the few hundred that carry
     * the site. Episodes stay crawlable from their season page instead.
     */
    expect(code).toContain("seasonPath(");
    expect(code).not.toContain("episodePath(");
  });

  it("only emits a season for a show it can name", () => {
    // seasonPath needs the show title for the slug. Emitting a slugless URL
    // would create a second address for a page whose canonical has the slug.
    expect(code).toMatch(/if \(!tvNames\.has\(showId\)\) continue;/);
  });
});
