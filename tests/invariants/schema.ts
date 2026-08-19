import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE = join(ROOT, "migrations", "000_baseline.sql");

/**
 * The baseline is a pg_dump of production, so it is the only description of the
 * schema in this repo that is generated rather than remembered. Parsing it is
 * what lets these tests check the code against the database instead of against
 * a list somebody kept up to date by hand — which is the habit that produced
 * most of the bugs they exist to catch.
 */
const sql = readFileSync(BASELINE, "utf8");

export const tableColumns: Map<string, Set<string>> = (() => {
  const out = new Map<string, Set<string>>();
  const re = /^CREATE TABLE public\.(\w+) \(\n([\s\S]*?)^\);/gm;
  for (const m of sql.matchAll(re)) {
    const cols = new Set<string>();
    for (const raw of m[2].split("\n")) {
      const line = raw.trim();
      if (!line || /^(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY)\b/i.test(line)) continue;
      // pg_dump quotes reserved words: `"position" smallint NOT NULL`.
      // Missing that made this parser report real columns as absent.
      const name = /^"?(\w+)"?\s+/.exec(line);
      if (name) cols.add(name[1]);
    }
    out.set(m[1], cols);
  }
  return out;
})();

/** Every UNIQUE / PRIMARY KEY column-set per table, as sorted `a,b,c` keys. */
export const uniqueKeys: Map<string, Set<string>> = (() => {
  const out = new Map<string, Set<string>>();
  const add = (table: string, cols: string) => {
    const key = cols
      .split(",")
      .map((c) => c.trim().replace(/"/g, ""))
      .sort()
      .join(",");
    if (!out.has(table)) out.set(table, new Set());
    out.get(table)!.add(key);
  };
  // ALTER TABLE ONLY public.x ADD CONSTRAINT n PRIMARY KEY (a, b);
  for (const m of sql.matchAll(
    /ALTER TABLE ONLY public\.(\w+)[\s\S]*?ADD CONSTRAINT \w+ (?:PRIMARY KEY|UNIQUE) \(([^)]+)\)/g,
  )) {
    add(m[1], m[2]);
  }
  // Inline, inside CREATE TABLE.
  for (const m of sql.matchAll(/^CREATE TABLE public\.(\w+) \(\n([\s\S]*?)^\);/gm)) {
    for (const cm of m[2].matchAll(/(?:PRIMARY KEY|UNIQUE)\s*\(([^)]+)\)/g)) add(m[1], cm[1]);
  }
  // CREATE UNIQUE INDEX ... ON public.x USING btree (a, b)
  for (const m of sql.matchAll(/CREATE UNIQUE INDEX \w+ ON public\.(\w+) USING \w+ \(([^)]+)\)/g)) {
    add(m[1], m[2]);
  }
  return out;
})();

/** Columns explicitly withheld from anon/authenticated by a per-column GRANT. */
export const revokedColumns: Map<string, Set<string>> = (() => {
  const granted = new Map<string, Set<string>>();
  for (const m of sql.matchAll(/GRANT SELECT\(([^)]+)\) ON TABLE public\.(\w+) TO (\w+)/g)) {
    if (m[3] !== "anon" && m[3] !== "authenticated") continue;
    if (!granted.has(m[2])) granted.set(m[2], new Set());
    granted.get(m[2])!.add(m[1].trim());
  }
  const out = new Map<string, Set<string>>();
  for (const [table, allowed] of granted) {
    const all = tableColumns.get(table);
    if (!all) continue;
    const withheld = new Set([...all].filter((c) => !allowed.has(c)));
    if (withheld.size) out.set(table, withheld);
  }
  return out;
})();

export function sourceFiles(dir = join(ROOT, "src"), acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

export const read = (f: string) => readFileSync(f, "utf8");
export const rel = (f: string) => f.slice(ROOT.length + 1);
export const apiRoutes = () =>
  sourceFiles(join(ROOT, "src", "app", "api")).filter((f) => f.endsWith("route.ts"));
