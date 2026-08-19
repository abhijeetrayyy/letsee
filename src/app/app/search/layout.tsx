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
 * The sitemap lists `/app/search` itself; this makes the two disagree, and the
 * disagreement is intentional. Removing it from the sitemap instead is the
 * tidier-looking option and the wrong one — the page is a legitimate
 * destination for a person, just not a result.
 */
export const metadata: Metadata = {
  title: "Search",
  description:
    "Search films, series, people and keywords. Everything you find can be logged, rated and argued about.",
  alternates: { canonical: "/app/search" },
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
