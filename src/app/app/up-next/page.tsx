import UpNextClient from "./UpNextClient";

/**
 * Up next: choose what to watch next (docs/design/PAGES.md §3). `/app/watchlist`
 * redirects here (next.config.mjs).
 *
 * A static shell: the queue is read in the browser under the viewer's own
 * RLS, so opening this tab costs no server render. robots.txt disallows
 * everything; `noindex` answers anything that arrives anyway.
 */
export const metadata = {
  title: "Up next",
  robots: { index: false, follow: false },
};

export default function UpNextPage() {
  return <UpNextClient />;
}
