import type { Metadata } from "next";

/**
 * A public index page the sitemap advertises, which until now inherited the
 * site title and the site description — so `/app/clubs`, `/app/person` and
 * `/app/lists` all described themselves to a crawler in identical words.
 */
export const metadata: Metadata = {
  title: "People",
  description: "Directors, actors and crew — every name behind the films and series people here are tracking.",
  openGraph: {
    title: "People · LetSee",
    description: "Directors, actors and crew — every name behind the films and series people here are tracking.",
    url: "/app/person",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
