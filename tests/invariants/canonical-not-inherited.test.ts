import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { read, rel, sourceFiles } from "./schema";

/**
 * A canonical set on a layout is inherited by every route beneath it.
 *
 * This is not a hypothetical. It was done twice in one sitting:
 *
 *   - `/app` — caught before shipping by counting the thirteen routes under it
 *     that set no canonical of their own. One is `/app/review/[id]`, which
 *     carries Review JSON-LD; it would have announced `/app` as its canonical,
 *     which is a request to be dropped as a duplicate.
 *   - `/app/profile` — not caught by reasoning, because the reasoning was
 *     wrong. The comment on it claimed every route beneath set its own
 *     canonical. `/app/profile/<user>/year/<year>` does, but only on its
 *     *success* path; its noindex fallback sets none, so it immediately began
 *     reporting `/app/profile`. Found by reading the rendered HTML.
 *
 * Nothing about the inherited tag looks wrong locally. The layout is correct,
 * the page is correct, and the bug only exists in the pair — which is exactly
 * the kind of thing that survives review and is worth a test.
 *
 * The rule is narrow on purpose: a layout may carry a canonical when it wraps
 * exactly one route, because then there is nothing to inherit it. That is a
 * real pattern here — a page that must be a client component gets its metadata
 * from a leaf layout.
 */
describe("no canonical on a layout that has routes beneath it", () => {
  const CANONICAL = /alternates\s*:\s*\{[^}]*canonical/;

  /** Does this layout's directory contain any nested route? */
  const hasNestedRoutes = (dir: string): boolean =>
    readdirSync(dir).some((entry) => {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) return false;
      // A nested segment counts only if it actually renders something.
      const stack = [full];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (existsSync(join(cur, "page.tsx"))) return true;
        for (const child of readdirSync(cur)) {
          const c = join(cur, child);
          if (statSync(c).isDirectory()) stack.push(c);
        }
      }
      return false;
    });

  it("keeps inheritable canonicals off layouts", () => {
    const offenders = sourceFiles()
      .filter((f) => f.endsWith("layout.tsx"))
      .filter((f) => CANONICAL.test(read(f)))
      .filter((f) => hasNestedRoutes(dirname(f)))
      .map((f) => rel(f));

    // Move it to the page. A page's metadata is inherited by nothing.
    expect(offenders).toEqual([]);
  });
});
