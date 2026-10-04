/**
 * A client page cannot export `metadata`, so the route's title and noindex
 * live here. The page reads your own row in the browser, so it stays static.
 */
export const metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
