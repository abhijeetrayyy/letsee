import FindPeopleClient from "./FindPeopleClient";

/**
 * Find people: everyone on letsee you might want to know — by name, by taste,
 * through the people you follow, or because they've just arrived. A static
 * shell; every shelf is read in the browser under the viewer's own RLS.
 */
export const metadata = {
  title: "Find people",
  robots: { index: false, follow: false },
};

export default function FindPeoplePage() {
  return <FindPeopleClient />;
}
