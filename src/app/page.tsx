import type { Metadata } from "next";
import FrontDoor from "@components/doors/FrontDoor";

/**
 * On the page, not the root layout, and this is the one that mattered most.
 *
 * `alternates.canonical` is inherited, and the root layout carried
 * `canonical: "/"` — so every page in the app that set none of its own
 * announced itself as a duplicate of the marketing homepage. Verified in
 * rendered HTML before the change: /app/quick-add, /app/import, /app/watchlist,
 * /app/notification and the year-in-review fallback all emitted
 * `<link rel="canonical" href="https://…/">`.
 *
 * Most of those are `noindex`, where a canonical is moot, but the tag was
 * wrong on all of them and one bad page without a canonical of its own was all
 * it would have taken.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** The front door (docs/design/RETHINK.md §3a). Signed-in visitors are sent Home by the proxy. */
export default function HomePage() {
  return <FrontDoor />;
}
