import LinksClient from "./LinksClient";

export const metadata = {
  title: "Links you've sent",
  alternates: { canonical: "/app/links" },
  robots: { index: false, follow: false },
};

/**
 * The passes you've sent as links (migration 108): how each is doing, a copy
 * of the link, and Stop. Static; your links are read in the browser, and only
 * you can read them.
 */
export default function LinksPage() {
  return <LinksClient />;
}
