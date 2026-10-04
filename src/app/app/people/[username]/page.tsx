import RoomClient from "./RoomClient";

/**
 * A room with one person (docs/design/PAGES.md §2). Private: robots.txt
 * disallows everything, and `noindex` answers anything that arrives anyway.
 * The room is read in the browser under the viewer's own row-level security.
 */
export const metadata = {
  title: "Room",
  robots: { index: false, follow: false },
};

export default async function RoomPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <RoomClient username={decodeURIComponent(username)} />;
}
