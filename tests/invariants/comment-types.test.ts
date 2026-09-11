import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The client's list of commentable things must equal the database's.
 *
 * ── The bug this exists for ────────────────────────────────────────────────
 * `comments` is keyed polymorphically on `(item_id text, item_type text)`, so
 * what a thread hangs off is a free-text string whose legal values live in two
 * places: a `CHECK` constraint in SQL and a `COMMENTABLE_TYPES` array in
 * TypeScript. They were kept in step by hand in 038 and again in 049, and then
 * diverged: `TitleTalk` renders on season pages with `scope="season"` and posts
 * `item_type = 'season'`, the client array lists it, and the constraint did
 * not.
 *
 * Every reply typed on a season page was rejected by Postgres. It never showed
 * up as an incident because nothing threw — `postComment` returns
 * `error.message` as a string, and the component renders returned strings as
 * validation messages, so a constraint violation looked exactly like the
 * product telling the user something reasonable.
 *
 * 094 adds the missing value. This is what stops it happening a fourth time.
 *
 * ── Why this reads the migrations and not just the baseline ────────────────
 * `000_baseline.sql` is regenerated from production with `npm run db:dump`
 * after a migration is applied, so between writing a migration and applying it
 * the baseline is deliberately behind. Taking the last definition in numeric
 * order across every migration file — baseline included, since it sorts first
 * as 000 — describes the schema the code is being written against rather than
 * the one that happens to be deployed.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MIGRATIONS = join(ROOT, "migrations");
const CLIENT = join(ROOT, "src", "lib", "db", "comments.ts");

/** Every `*.sql` under migrations/, in the order Postgres would have seen them. */
function migrationsInOrder(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => {
      const na = Number(a.slice(0, 3));
      const nb = Number(b.slice(0, 3));
      // Files without a numeric prefix (APPLY_056_TO_062.sql) sort last and are
      // not authoritative for anything; NaN comparisons fall through to name.
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return a.localeCompare(b);
    })
    .map((f) => join(MIGRATIONS, f));
}

/** The last `comments_item_type_check` definition anyone wrote. */
function typesFromSchema(): string[] {
  let latest: string[] | null = null;

  for (const file of migrationsInOrder()) {
    const sql = readFileSync(file, "utf8");
    // Both spellings appear in this repo: `IN ('a','b')` in the hand-written
    // migrations, `= ANY (ARRAY['a'::text, ...])` in the pg_dump baseline.
    const re = /CONSTRAINT comments_item_type_check\s+CHECK\s*\(([\s\S]*?)\)\s*[;,)]/g;
    for (const m of sql.matchAll(re)) {
      const values = [...m[1].matchAll(/'([a-z_]+)'/g)].map((v) => v[1]);
      if (values.length) latest = values;
    }
    // `ALTER TABLE ... ADD CONSTRAINT comments_item_type_check CHECK (...)`
    const alter =
      /ADD CONSTRAINT comments_item_type_check\s*\n?\s*CHECK\s*\(([\s\S]*?)\);/g;
    for (const m of sql.matchAll(alter)) {
      const values = [...m[1].matchAll(/'([a-z_]+)'/g)].map((v) => v[1]);
      if (values.length) latest = values;
    }
  }

  return latest ?? [];
}

/** The array the browser validates against before it inserts. */
function typesFromClient(): string[] {
  const src = readFileSync(CLIENT, "utf8");
  const block = /export const COMMENTABLE_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const;/.exec(src);
  if (!block) throw new Error("COMMENTABLE_TYPES not found in src/lib/db/comments.ts");
  return [...block[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("commentable types", () => {
  it("finds a CHECK constraint to compare against", () => {
    expect(typesFromSchema().length).toBeGreaterThan(0);
  });

  it("the client allows exactly what the database allows", () => {
    const schema = [...typesFromSchema()].sort();
    const client = [...typesFromClient()].sort();

    // Both directions matter, and they fail differently. A value the client
    // allows and the schema does not is the season bug: a reply the user
    // believes they posted, rejected. A value the schema allows and the client
    // does not is a thread nothing can ever write to — dead capacity that
    // reads as a supported feature.
    expect(client.filter((t) => !schema.includes(t))).toEqual([]);
    expect(schema.filter((t) => !client.includes(t))).toEqual([]);
  });

  it("still allows a season, which is what 094 was for", () => {
    expect(typesFromSchema()).toContain("season");
    expect(typesFromClient()).toContain("season");
  });
});
