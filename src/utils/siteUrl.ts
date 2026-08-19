/**
 * The app's public origin, in one place.
 *
 * `robots`, `sitemap`, canonical URLs and Open Graph tags all have to agree on
 * this, and the share sheet was previously carrying its own copy — the
 * production hostname was hard-coded twice in `sendCard.tsx` as the fallback
 * for an environment variable the README never told anyone to set.
 *
 * Preference order, and why:
 *   1. NEXT_PUBLIC_APP_URL — what the operator says the site is.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — set by Vercel on every deployment and
 *      always the production domain, not the per-deploy preview URL, so a
 *      preview build does not emit canonical links pointing at itself.
 *   3. The known production host, as a last resort so a misconfigured
 *      deployment emits something correct rather than something broken.
 *
 * Always returns an absolute origin with no trailing slash.
 */
const FALLBACK = "https://letsee-dusky.vercel.app";

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return FALLBACK;
}

/** Absolute URL for a path like `/app/profile/ray`. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
