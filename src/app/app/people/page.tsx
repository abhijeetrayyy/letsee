import PeopleClient from "./PeopleClient";

/**
 * People: who reached you, and where you talk to them (docs/design/PAGES.md §2).
 *
 * The page itself is a static shell; the rooms are read in the browser under
 * the viewer's own row-level security, so opening this tab costs no server
 * work. robots.txt disallows everything; `noindex` answers anything that
 * arrives anyway.
 */
export const metadata = {
  title: "People",
  robots: { index: false, follow: false },
};

export default function PeoplePage() {
  return <PeopleClient />;
}
