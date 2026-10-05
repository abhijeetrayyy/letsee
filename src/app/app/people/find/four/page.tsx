import BlindFourClient from "./BlindFourClient";

/** Blind four: strangers' four favourite films, turned over to meet them. A static shell; the deck is read in the browser. */
export const metadata = {
  title: "Blind four",
  robots: { index: false, follow: false },
};

export default function BlindFourPage() {
  return <BlindFourClient />;
}
