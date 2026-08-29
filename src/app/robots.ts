import type { MetadataRoute } from "next";

/**
 * Nothing is crawlable. This is a closed app for signed-in people.
 *
 * ── Why this file went from "allow with exceptions" to "deny everything" ───
 *
 * The previous version allowed `/` with a short deny list, which is the right
 * shape for a site that wants search traffic. This one does not want search
 * traffic, and the reason is on the bill.
 *
 * On 19–20 Aug the app published a sitemap of 1021 URLs, gave every page a
 * canonical, and pointed robots.txt at it. On 23 Aug an overage paused the
 * deployment, and the fix (56196a6) moved the crawler-facing pages onto ISR.
 * By 26–28 Aug those pages had written **1.24M ISR write units — 99.6% of the
 * account's usage, about $14 in three days** — because the link graph a
 * crawler sees here has no bottom: a title links to its cast page, that page
 * emits 348 person links, each person links back to every title they worked
 * on. The reachable set is TMDB's whole catalogue, and ISR bills a write for
 * every distinct URL, then bills again each time `revalidate` expires.
 *
 * No amount of tuning fixes that, because the page count is a property of the
 * link graph rather than of the rendering strategy. The only fix that is about
 * the cause is to stop being crawled.
 *
 * ── What this does and does not buy ────────────────────────────────────────
 *
 * `Disallow: /` is a **request**, and the well-behaved honour it: Googlebot,
 * Bingbot, GPTBot, ClaudeBot, PerplexityBot. Plenty do not — Bytespider and
 * most scrapers read robots.txt only to find out what is worth taking.
 *
 * So this file is the polite half. The enforcing half is a Vercel Firewall
 * rule, which runs at the edge before any function or ISR lookup and therefore
 * costs nothing when it denies. It cannot live in this repo: `proxy.ts` only
 * matches requests that already carry a session cookie, precisely so that
 * signed-out traffic costs no invocation — putting a user-agent check in
 * middleware would mean running middleware for every bot again, which is the
 * 527,753 invocations that matcher was written to avoid.
 *
 * ── No sitemap line ────────────────────────────────────────────────────────
 *
 * There is no sitemap any more; `src/app/sitemap.ts` is deleted. A sitemap is
 * an invitation, and it was also four paginated Supabase queries behind a
 * cached route that any crawler ignoring robots.txt could still pull.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
