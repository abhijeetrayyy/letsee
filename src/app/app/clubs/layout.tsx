import type { Metadata } from "next";

/**
 * A public index page the sitemap advertises, which until now inherited the
 * site title and the site description — so `/app/clubs`, `/app/person` and
 * `/app/lists` all described themselves to a crawler in identical words.
 */
export const metadata: Metadata = {
  title: "Film clubs",
  description: "Groups watching the same film on the same week. Join a club, see its pick, and argue about it with people who actually turned up.",
  alternates: { canonical: "/app/clubs" },
  openGraph: {
    title: "Film clubs · LetSee",
    description: "Groups watching the same film on the same week. Join a club, see its pick, and argue about it with people who actually turned up.",
    url: "/app/clubs",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
