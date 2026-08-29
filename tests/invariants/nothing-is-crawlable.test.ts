import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { read, rel, sourceFiles } from "./schema";

/**
 * The app is closed to crawlers, and it has to stay closed.
 *
 * This replaces `robots-and-sitemap-agree` and `sitemap-pagination`, which
 * checked that the two files did not contradict each other. There is no
 * sitemap to contradict any more.
 *
 * The reason is the bill. Between 26 and 28 Aug the ISR routes wrote 1.24M
 * write units — 99.6% of the account's usage, roughly $14 in three days —
 * because a crawler that enters here can walk title → cast page (348 person
 * links) → person → every title they worked on, and every distinct URL on that
 * walk is a billable persistent write. The reachable set is TMDB's catalogue.
 *
 * The failure this guards against is somebody re-enabling SEO for a reason that
 * sounds good in isolation — "we should be discoverable", "add a sitemap for
 * launch" — without knowing that the last time it was on it paused the
 * deployment twice on two different meters. If that is a deliberate decision,
 * delete this test in the same commit and say why. It should not be possible to
 * do it by accident.
 */
describe("nothing is crawlable", () => {
  const robotsSrc = () =>
    read(sourceFiles().find((f) => rel(f) === join("src", "app", "robots.ts"))!);

  it("robots.txt disallows the whole site", () => {
    const src = robotsSrc();
    expect(src).toMatch(/disallow:\s*"\/"/);
  });

  it("robots.txt allows nothing back in", () => {
    // An `allow` key would carve an exception out of the blanket deny, and
    // crawlers honour the more specific rule.
    expect(robotsSrc()).not.toMatch(/^\s*allow:/m);
  });

  it("advertises no sitemap", () => {
    expect(robotsSrc()).not.toMatch(/sitemap:/i);
    expect(existsSync(join(process.cwd(), "src", "app", "sitemap.ts"))).toBe(false);
  });

  it("the root layout ships noindex, nofollow", () => {
    const layout = read(
      sourceFiles().find((f) => rel(f) === join("src", "app", "layout.tsx"))!,
    );
    const block = layout.slice(layout.indexOf("robots: {"));
    expect(block).toMatch(/index:\s*false/);
    expect(block).toMatch(/follow:\s*false/);
  });
});
