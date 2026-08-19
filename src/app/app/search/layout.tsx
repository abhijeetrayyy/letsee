import type { Metadata } from "next";

/**
 * Covers `/app/search` and every `/app/search/[query]` beneath it.
 *
 * `noindex, follow` is deliberate and is the standard treatment for an internal
 * search results page: the query space is unbounded, so a crawler that starts
 * indexing them generates an endless supply of near-identical thin pages that
 * compete with the title pages they link to. `follow` keeps the links on them
 * live, which is the part worth having — a results page is a good way into the
 * catalogue and a bad thing to rank.
 *
 * No canonical here. It was set to `/app/search`, and because `alternates` is
 * inherited that made `/app/search/matrix` announce the bare landing page as
 * its canonical — a results page is not a duplicate of the search box. Both
 * are `noindex` so nothing was lost in practice, but the tag was a lie.
 *
 * `/app/search` has also been dropped from the sitemap. Submitting a URL you
 * have told the crawler to ignore is the contradiction Search Console reports
 * as "Submitted URL marked noindex".
 */
export const metadata: Metadata = {
  title: "Search",
  description:
    "Search films, series, people and keywords. Everything you find can be logged, rated and argued about.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
