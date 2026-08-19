import { describe, expect, it } from "vitest";
import { apiRoutes, read, rel, sourceFiles, uniqueKeys } from "./schema";

/**
 * `apiResponse.ts` states the rule in prose, four lines above the option that
 * breaks it: "Only pass a positive value for routes returning the SAME response
 * to every visitor regardless of auth state."
 *
 * Four routes passed one anyway. `/api/upcoming-episodes` was the worst — it
 * takes no query parameters at all, so the CDN key was the bare path and the
 * first signed-in caller's watch queue was served to everyone else.
 *
 * A rule written in a comment is a rule until someone is in a hurry. This is
 * the same rule, enforced.
 */
describe("no shared cache on a response that depends on who is asking", () => {
  const IDENTITY = /getAuthUserId|auth\.getUser|\bviewerId\b|\bcurrentUserId\b/;

  /**
   * Comments do not read a session.
   *
   * The first draft matched the bare word "viewer" anywhere in the file and
   * flagged /api/reviews/popular, whose comment reads "the response is
   * identical for every viewer and can be cached" — the justification for
   * caching, read as evidence against it. A heuristic over prose finds prose.
   */
  const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("keeps every identity-aware route out of shared caches", () => {
    const problems: string[] = [];
    for (const file of apiRoutes()) {
      const source = code(read(file));
      if (!IDENTITY.test(source)) continue;
      for (const m of source.matchAll(/maxAge:\s*(\d+)/g)) {
        if (Number(m[1]) > 0) {
          problems.push(`${rel(file)}: maxAge ${m[1]} on a route that reads an identity`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("still allows a shared cache on genuinely public routes", () => {
    // Guard against the rule above being satisfied by nobody caching anything.
    const cached = apiRoutes().filter((f) => /maxAge:\s*[1-9]/.test(read(f)));
    expect(cached.length).toBeGreaterThan(5);
  });
});

/**
 * Postgres requires an ON CONFLICT target to name a real unique constraint.
 * Migration 064 widened four keys to include `item_type`, and every call site
 * was updated except `/api/batch`, which still named `user_id, item_id`. That
 * route answers 42P10 on every call and nobody noticed, because nothing calls
 * it — it sat as a landmine for whoever wired it up next.
 */
describe("every upsert names a constraint that exists", () => {
  it("matches each onConflict column set to a UNIQUE or PRIMARY KEY", () => {
    const problems: string[] = [];
    for (const file of sourceFiles()) {
      const source = read(file);
      const re =
        /\.from\(\s*["'`](\w+)["'`]\s*\)(?:(?!\.from\()[\s\S]){0,600}?onConflict:\s*["'`]([^"'`]+)["'`]/g;
      for (const m of source.matchAll(re)) {
        const [table, target] = [m[1], m[2]];
        const keys = uniqueKeys.get(table);
        if (!keys) continue;
        const normalised = target
          .split(",")
          .map((c) => c.trim())
          .sort()
          .join(",");
        if (!keys.has(normalised)) {
          problems.push(
            `${rel(file)}: onConflict "${target}" on ${table} matches no unique key ` +
              `(has: ${[...keys].join(" | ")})`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

/**
 * The old guard was `if (expected && header !== expected) return 401`, which is
 * not a guard when the variable is unset — it skips. `/api/cron/purge-deleted`
 * hard-deletes accounts, and `run-jobs` and `check-availability` hold a
 * service-role client.
 */
describe("cron routes fail closed", () => {
  const cronRoutes = apiRoutes().filter((f) => f.includes("/api/cron/"));

  it("has cron routes to check", () => {
    expect(cronRoutes.length).toBeGreaterThanOrEqual(4);
  });

  it("routes every cron endpoint through the shared guard", () => {
    const problems = cronRoutes
      .filter((f) => !read(f).includes("guardCron"))
      .map((f) => `${rel(f)} does not call guardCron`);
    expect(problems).toEqual([]);
  });

  it("has no route re-implementing the guard that used to fail open", () => {
    const problems = apiRoutes()
      .filter((f) => /expectedToken\s*&&/.test(read(f)))
      .map((f) => `${rel(f)} re-implements the fail-open CRON_SECRET check`);
    expect(problems).toEqual([]);
  });
});

/**
 * Two schema helpers were written with the rest and then wired to nothing.
 *
 * `profileLd` and `itemListLd` sat exported and unused while profiles and lists
 * — both published in the sitemap — were crawled with no structured data at
 * all. Nothing was broken, no test failed, and the helpers looked finished
 * because they were; they simply had no caller. That is the same miss as the
 * slug helpers, and it is invisible to every other kind of check.
 */
describe("every structured-data helper has a caller", () => {
  const HELPERS = [
    "organisationLd",
    "breadcrumbLd",
    "movieLd",
    "tvSeriesLd",
    "tvSeasonLd",
    "tvEpisodeLd",
    "personLd",
    "reviewLd",
    "profileLd",
    "itemListLd",
  ];

  it("is called from somewhere outside its own module", () => {
    const callers = sourceFiles().filter((f) => !rel(f).endsWith("structuredData.ts"));
    const corpus = callers.map(read).join("\n");

    const orphans = HELPERS.filter((h) => !new RegExp(`\\b${h}\\s*\\(`).test(corpus));

    // A helper with no caller is either dead code or a page missing its graph.
    // Delete it or wire it — do not leave it looking done.
    expect(orphans).toEqual([]);
  });
});
