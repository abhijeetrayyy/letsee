import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { read, rel, sourceFiles } from "./schema";

/**
 * A sitemap is a list of URLs you are asking a crawler to fetch. robots.txt is
 * a list you are telling it not to. A path on both is a contradiction, and
 * Search Console reports it as "Indexed, though blocked by robots.txt" or
 * "Submitted URL blocked by robots.txt" — a warning that reads like a bug in
 * the site rather than a disagreement between two files nobody diffs.
 *
 * This has already happened once here in the other direction: `/app/search` was
 * in the sitemap while the page carried `noindex`. I defended that at the time
 * as an intentional disagreement, which it was not — it was a mistake, and the
 * fix was to take it out of the sitemap.
 *
 * Only the static half can be checked from source; the dynamic half is titles,
 * profiles, lists, seasons and reviews, none of which can collide with a
 * disallow rule without something much stranger having happened. Verified
 * against the live sitemap too — 1021 URLs, none blocked — but that check needs
 * a deployment and this one does not.
 */
describe("robots.txt and the sitemap do not contradict each other", () => {
  const fileNamed = (name: string) =>
    sourceFiles().find((f) => rel(f) === join("src", "app", name))!;

  const disallowed = () => {
    const src = read(fileNamed("robots.ts"));
    const block = src.slice(src.indexOf("disallow:"), src.indexOf("]", src.indexOf("disallow:")));
    return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };

  const staticSitemapPaths = () => {
    const src = read(fileNamed("sitemap.ts"));
    const block = src.slice(src.indexOf("STATIC_PATHS"), src.indexOf("export default"));
    return [...block.matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);
  };

  it("reads both lists", () => {
    expect(disallowed().length).toBeGreaterThan(0);
    expect(staticSitemapPaths().length).toBeGreaterThan(0);
  });

  it("lists no path in the sitemap that robots.txt blocks", () => {
    const rules = disallowed();
    const collisions = staticSitemapPaths().flatMap((p) =>
      rules.filter((d) => p.startsWith(d)).map((d) => `${p} blocked by ${d}`),
    );
    expect(collisions).toEqual([]);
  });

  /**
   * The subtler half of the same rule. A `noindex` page must stay *crawlable*:
   * if robots.txt blocks it, the crawler never fetches the page and so never
   * reads the meta tag telling it not to index — which is how a blocked URL
   * ends up indexed from inbound links alone, with no description.
   */
  it("does not block the search pages it relies on noindex for", () => {
    const searchLayout = read(fileNamed(join("app", "search", "layout.tsx")));
    expect(searchLayout).toMatch(/index:\s*false/);
    expect(disallowed().some((d) => "/app/search".startsWith(d))).toBe(false);
  });
});
