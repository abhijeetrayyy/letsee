"use client";

import { useAuth } from "@/app/contextAPI/AuthProvider";

/**
 * Show this only to someone signed in — decided in the browser, on purpose.
 *
 * ── What one session read costs a page ─────────────────────────────────────
 * `/app` is where every signed-in visit begins, and it was `ƒ` in the build
 * output: a full server render, per visitor, per visit. The only reason was a
 * single `auth.getUser()` in the page body, used to pick between a greeting and
 * a sign-up card. One cookie read opts a route out of caching entirely — the
 * fault the August incident names R2 and found three separate times — and here
 * it was doing it to the busiest page in the product.
 *
 * The branch itself is not the problem; *where* it was evaluated was. The
 * client already knows the answer: `AuthProvider` holds it, from the same
 * cookie, with no request of its own. So the page renders both possibilities
 * into static HTML the CDN can hand to everybody, and the browser picks one.
 *
 * ── The cost of doing it this way ──────────────────────────────────────────
 * Both branches ship in the HTML. That is about a kilobyte on a 131 KB page,
 * paid once per visitor, against a full render per visitor — and the children
 * that actually cost something (the sidebar, the feed, the recommendations) are
 * client components that never mount when their gate says no, so nothing
 * fetches for the wrong audience.
 *
 * ── Why nothing renders until `ready` ──────────────────────────────────────
 * Rendering the signed-out card first and swapping it a beat later would show
 * every returning user a "Join the community" pitch on arrival. An empty space
 * that fills in is honest; a wrong answer that corrects itself is not.
 */
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready || !isAuthenticated) return null;
  return <>{children}</>;
}

/** The other half of the same gate — see `SignedIn`. */
export function SignedOut({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  if (!ready || isAuthenticated) return null;
  return <>{children}</>;
}
