import type { Metadata } from "next";

/**
 * A public index page the sitemap advertises, which until now inherited the
 * site title and the site description — so `/app/clubs`, `/app/person` and
 * `/app/lists` all described themselves to a crawler in identical words.
 *
 * Title and description only. This page is a client component so its metadata
 * has to live on a layout, and a canonical set here would be inherited by the
 * detail routes beneath — including their noindex fallbacks, which set none of
 * their own. A missing self-canonical on one index page costs far less than a
 * wrong one on every page under it.
 */
export const metadata: Metadata = {
  title: "Lists",
  description: "Hand-made lists of films and series, built by people rather than an algorithm.",
  openGraph: {
    title: "Lists · LetSee",
    description: "Hand-made lists of films and series, built by people rather than an algorithm.",
    url: "/app/lists",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
