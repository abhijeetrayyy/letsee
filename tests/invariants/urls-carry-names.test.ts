import { describe, expect, it } from "vitest";
import { read, rel, sourceFiles } from "./schema";

/**
 * `/app/movie/550` tells a person nothing and a search engine less.
 *
 * The slug helpers were added, every route learned to parse `550-fight-club`,
 * every page emitted a canonical carrying the name — and then search kept
 * handing out bare ids, because `getHref` was written before the helpers
 * existed and nothing made it wrong. Click a search result and the address bar
 * went blank. That is the single most common way anyone reaches a title page,
 * so the most-used links in the app were the last ones without names.
 *
 * Fourteen more call sites had the same shape: the home rail, the notification
 * deep link, the Director row, episode guest stars, season navigation. Three of
 * them had hand-rolled their own slugify inline, one of those with a stray
 * `.toLowerCase()` in a different position, which is what a helper existing but
 * not being reachable looks like.
 *
 * A rule that lives only in `urls.ts` is a rule until the next component. This
 * is the same rule, enforced.
 */
describe("detail links are built through the slug helpers", () => {
  /**
   * Any `/app/<kind>/<id>` built by hand.
   *
   * The alternation covers a literal kind; the second branch covers an
   * interpolated one. That second branch is not hypothetical — the first
   * version of this test only had the first, and the search modal's live TMDB
   * rows wrote `/app/${kind}/${hit.id}`, so the test passed while the most-used
   * links in the app were still nameless. The second attempt used `\w+` for the
   * interpolated kind, which still missed `/app/${t.itemType}/...` because a
   * dot is not a word character — the activity feed stayed broken through two
   * green runs. `[^}]+` is deliberate: a pattern that under-matches here reads
   * exactly like a pass.
   */
  const RAW_LINK = /["'`]\/app\/(?:(?:movie|tv|person)\/\$\{|\$\{[^}]+\}\/\$\{)/g;

  /** Hand-rolled slugification — the helper exists; there is no second one. */
  const INLINE_SLUG = /\.replace\(\/\[\^a-zA-Z0-9\]\/g/g;

  const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  /**
   * `urls.ts` is where the helpers live, so it is the one file allowed to write
   * these paths out by hand.
   */
  const EXEMPT = new Set([rel(`${process.cwd()}/src/utils/urls.ts`)]);

  const offenders = (pattern: RegExp) =>
    sourceFiles()
      .filter((f) => !EXEMPT.has(rel(f)))
      .flatMap((f) => {
        const src = code(read(f));
        const hits = src.match(new RegExp(pattern.source, "g")) ?? [];
        return hits.length > 0 ? [`${rel(f)} (${hits.length})`] : [];
      });

  it("never interpolates a detail path directly", () => {
    // Every one of these should be titlePath / personPath / seasonPath /
    // episodePath. If a name is genuinely unavailable at the call site, thread
    // it through rather than dropping the slug — the helpers already accept an
    // empty name and fall back to the bare id.
    expect(offenders(RAW_LINK)).toEqual([]);
  });

  it("never re-implements slugify", () => {
    expect(offenders(INLINE_SLUG)).toEqual([]);
  });
});
