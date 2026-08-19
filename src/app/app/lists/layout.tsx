import type { Metadata } from "next";

/**
 * A public index page the sitemap advertises, which until now inherited the
 * site title and the site description — so `/app/clubs`, `/app/person` and
 * `/app/lists` all described themselves to a crawler in identical words.
 */
export const metadata: Metadata = {
  title: "Lists",
  description: "Hand-made lists of films and series, built by people rather than an algorithm.",
  alternates: { canonical: "/app/lists" },
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
