import { describe, expect, it } from "vitest";
import { apiRoutes, read, rel, sourceFiles, tableColumns, revokedColumns } from "./schema";

/**
 * Every column a query names must exist, and must be one the app is allowed to
 * read. Checked against `migrations/000_baseline.sql`, which is generated from
 * production rather than maintained by hand.
 *
 * This is the single highest-value test in the repo, because "selects a column
 * that is not there any more" is a bug shape this codebase has produced
 * repeatedly and never noticed:
 *
 *   - tonight.ts selected `user_media_status.runtime_minutes`, dropped by 054.
 *     PostgREST answered 42703, the error branch returned [], and the strongest
 *     signal Tonight had contributed nothing for weeks — silently, because a
 *     failed read and an empty watchlist look identical.
 *   - /api/profile/public-reviews selected `*` after 076 revoked `review_text`,
 *     which took the whole Reviews section down in production.
 *   - A fix for that nearly added `score` to the same select. There is no such
 *     column on watched_items; the UI has been reading `undefined` for months.
 *
 * None of those throw in CI, and two of the three were invisible until someone
 * looked at the page.
 */

/** `.from("x").select("a, b")` where the select is a plain literal we can trust. */
function simpleSelects(source: string): { table: string; columns: string[] }[] {
  const out: { table: string; columns: string[] }[] = [];
  // The gap must not contain another `.from(`, or one statement's table gets
  // paired with the next statement's column list — which reported four columns
  // as missing that were simply on a different table.
  const re =
    /\.from\(\s*["'`](\w+)["'`]\s*\)(?:(?!\.from\()[\s\S]){0,400}?\.select\(\s*(["'])([^"'`]*?)\2/g;
  for (const m of source.matchAll(re)) {
    const [table, list] = [m[1], m[3]];
    // Skip embedded resources and star selects — a different test owns those.
    if (list.includes("(") || list.includes("*") || !list.trim()) continue;
    const columns = list
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      // `alias:column` — the real column is on the right.
      .map((c) => (c.includes(":") ? c.split(":").pop()!.trim() : c));
    if (columns.length) out.push({ table, columns });
  }
  return out;
}

describe("every selected column exists in the schema", () => {
  const files = sourceFiles();

  it("names no column the baseline does not have", () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const { table, columns } of simpleSelects(read(file))) {
        const known = tableColumns.get(table);
        if (!known) continue; // not a public table we track (views, rpc results)
        for (const col of columns) {
          if (!known.has(col)) problems.push(`${rel(file)}: ${table}.${col} does not exist`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("names no column that has been revoked from the app's roles", () => {
    const problems: string[] = [];
    for (const file of files) {
      for (const { table, columns } of simpleSelects(read(file))) {
        const withheld = revokedColumns.get(table);
        if (!withheld) continue;
        for (const col of columns) {
          if (withheld.has(col)) {
            problems.push(`${rel(file)}: ${table}.${col} is revoked from anon/authenticated`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("no star select on a table with withheld columns", () => {
  it("cannot ask for '*' where '*' includes something the role may not read", () => {
    // `select("*")` on such a table is not a style preference — it is a 42501,
    // and the form that slipped through review was `select("*", { count: … })`,
    // which a grep for `select("*")` does not match.
    const restricted = [...revokedColumns.keys()];
    const problems: string[] = [];
    for (const file of sourceFiles()) {
      const source = read(file);
      for (const table of restricted) {
        const re = new RegExp(
          `\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)(?:(?!\\.from\\()[\\s\\S]){0,400}?\\.select\\(\\s*["'\`]\\*`,
        );
        if (re.test(source)) problems.push(`${rel(file)}: select("*") on ${table}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("knows which tables are restricted, so this test cannot silently pass", () => {
    // If a future dump loses the column grants, the test above would trivially
    // pass. Assert the fixture is real.
    expect([...revokedColumns.keys()].sort()).toEqual(["users", "watched_items"]);
    expect(revokedColumns.get("users")).toContain("email");
    expect(revokedColumns.get("watched_items")).toContain("review_text");
  });
});

describe("api surface", () => {
  /**
   * A floor, not a target.
   *
   * Every column and upsert rule above is checked by walking `apiRoutes()`, so
   * a change that emptied that list would turn this whole file green while
   * checking nothing. The number is therefore deliberately just below the
   * current count and is expected to come *down* over time: routes that exist
   * only to forward a query the browser can make under RLS are being moved
   * client-side, and each one that goes takes a function invocation per page
   * view with it.
   *
   * Lower it when routes are deliberately removed. Never delete the assertion —
   * a suite that iterates an empty list is the failure this guards against.
   */
  it("has routes to check", () => {
    expect(apiRoutes().length).toBeGreaterThan(60);
  });
});

/**
 * An upsert needs privileges a column grant cannot give.
 *
 * `INSERT ... ON CONFLICT DO UPDATE` requires **table-level** SELECT, because
 * the DO UPDATE path has to read the conflicting row. Revoking the table grant
 * and re-granting column by column — which is the only way to hide a column
 * from a role, and what 072 and 076 do — therefore breaks every upsert on that
 * table, while leaving plain INSERT, UPDATE and SELECT working.
 *
 * It cost a production outage to learn: 072 hid `users.email`, and both
 * `.from("users").upsert(...)` calls started answering "permission denied for
 * table users". One of them is picking a handle, and the middleware bounces a
 * user without a handle back to onboarding — so every account created after
 * that migration was trapped there, with no way out and no error anyone saw
 * until someone signed up and said so.
 *
 * The fix is a SECURITY DEFINER function, which runs as the owner and is not
 * subject to the grants. This test is the reminder.
 */
describe("no upsert writes a column the role may not read", () => {
  /**
   * Known limit, stated rather than papered over: this sees inline payloads
   * only. `.upsert(someArray)` hides the columns behind a variable, and the
   * importer built exactly that — it stayed broken while this test was green.
   * Closing it properly needs real dataflow analysis; until then the comment
   * is the guard rail.
   */
  it("routes those writes through a SECURITY DEFINER function instead", () => {
    const problems: string[] = [];
    for (const file of sourceFiles()) {
      const source = read(file);
      for (const [table, withheld] of revokedColumns) {
        const call = new RegExp(
          `\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)(?:(?!\\.from\\()[\\s\\S]){0,400}?\\.upsert\\(`,
          "g",
        );
        for (const m of source.matchAll(call)) {
          // Only the upsert's own arguments count. A plain UPDATE elsewhere in
          // the file may set a withheld column freely — writing it reads
          // nothing. It is `ON CONFLICT DO UPDATE SET c = EXCLUDED.c` that
          // reads, and that lives inside this call.
          const args = source.slice(m.index! + m[0].length, m.index! + m[0].length + 600);
          for (const col of withheld) {
            if (new RegExp(`\\b${col}\\b`).test(args)) {
              problems.push(
                `${rel(file)}: upserts ${table} writing ${col}, which is revoked — ` +
                  `EXCLUDED.${col} needs SELECT on it`,
              );
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
