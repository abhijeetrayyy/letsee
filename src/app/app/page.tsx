import type { Metadata } from "next";
import HomeV2 from "@components/home/v2/HomeV2";

/**
 * On the page, deliberately not on the layout.
 *
 * `/app` had no title of its own — the landing page and the logged-in home
 * read identically to a crawler. The obvious fix is a layout, and it is a
 * trap: `alternates.canonical` is inherited, and thirteen routes under `/app`
 * set none of their own. Every one of them would have started announcing
 * `/app` as its canonical. A page's metadata is inherited by nothing.
 */
export const metadata: Metadata = {
  title: "Home",
  description: "Your people, what they watched this week, and what's waiting on you.",
  alternates: { canonical: "/app" },
};

/**
 * Home (docs/design/RETHINK.md §3, PAGES.md §1). A static page: everything on
 * it is read in the browser under the viewer's own RLS, and the device's
 * clock chooses the first card, so the server renders this once for everyone
 * and never again — no TMDB fetch, no hourly revalidation.
 */
export default function Home() {
  return <HomeV2 />;
}
