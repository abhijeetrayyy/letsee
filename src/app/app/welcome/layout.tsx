/**
 * A client component cannot export `metadata`, so the route's noindex lives
 * here. robots.txt already asks crawlers not to fetch this; this is what
 * answers one that arrives anyway — from a pasted link or a referrer.
 */
export const metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
