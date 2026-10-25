import SupportClient from "./SupportClient";

/**
 * Support letsee (docs/IDEAS_2026-10.md §6.2): the supporter tier, pre-sold
 * before it's built. A static shell; your pledge is read in the browser under
 * RLS (migration 127). Not indexed.
 */
export const metadata = {
  robots: { index: false, follow: false },
  title: "Support letsee",
  description: "A season ticket for letsee: what supporters would get, and a pledge that charges nothing yet.",
};

export default function SupportPage() {
  return <SupportClient />;
}
