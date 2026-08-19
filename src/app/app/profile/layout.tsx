import type { Metadata } from "next";

/**
 * The people directory. Public, works signed-out, and had no title of its own —
 * so the one page on the site whose entire job is being found by someone
 * looking for people described itself as "LetSee — Social Film Journal".
 *
 * Title and description only. The canonical lives on the page, and the reason
 * is a mistake made right here: it was set on this layout first, and
 * `/app/profile/<user>/year/<year>` immediately started reporting
 * `/app/profile` as its canonical — because that page's noindex fallback sets
 * none of its own, and `alternates` is inherited. Verified in the rendered
 * HTML, not reasoned about. A canonical belongs on the page it names.
 */
export const metadata: Metadata = {
  title: "Discover people",
  description:
    "Find people who watch what you watch. Browse profiles, see what they have logged, and follow the ones worth arguing with.",
  openGraph: {
    title: "Discover people · LetSee",
    description: "Find people who watch what you watch.",
    url: "/app/profile",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
