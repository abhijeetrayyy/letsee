import ActivityClient from "./ActivityClient";

/**
 * Activity: everything happening on letsee, or just among the people you
 * follow. A static shell; the feed is read in the browser under RLS.
 */
export const metadata = {
  title: "Activity",
  robots: { index: false, follow: false },
};

export default function ActivityPage() {
  return <ActivityClient />;
}
