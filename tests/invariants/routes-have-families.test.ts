import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { rel, sourceFiles } from "./schema";
import { ROUTES } from "../../src/design/routes";

/**
 * Every page has a family, and every family entry has a page.
 *
 * The redesign gives each route one of seven templates (docs/design/SYSTEM.md
 * §10). A page added without a decision would quietly draw its own layout —
 * which is how the app ended up with 29 content widths. This keeps the
 * manifest and the file system in step in both directions.
 */
function routeOf(file: string): string {
  const path = rel(file).replace(/^src\/app/, "").replace(/\/page\.tsx$/, "");
  return path === "" ? "/" : path;
}

describe("routes have families", () => {
  const pages = sourceFiles(join(process.cwd(), "src", "app"))
    .filter((f) => f.endsWith("/page.tsx"))
    .map(routeOf)
    .sort();

  it("every page.tsx is in src/design/routes.ts", () => {
    const missing = pages.filter((r) => !ROUTES[r]);
    expect(missing, `add these to src/design/routes.ts with a family`).toEqual([]);
  });

  it("every manifest entry still has a page", () => {
    const gone = Object.keys(ROUTES).filter((r) => !pages.includes(r));
    expect(gone, `these routes no longer exist; remove or redirect them in the manifest`).toEqual([]);
  });
});
