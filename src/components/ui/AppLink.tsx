import NextLink from "next/link";
import type { ComponentProps } from "react";

type AppLinkProps = ComponentProps<typeof NextLink>;

/**
 * `next/link`, with prefetching **off** by default.
 *
 * ── The measurement ────────────────────────────────────────────────────────
 * A `<Link>` left at Next's default prefetches when it scrolls into view. On a
 * page rendering one link, that is a good trade. On a page rendering a hundred,
 * it is a hundred requests nobody asked for, and this app is almost entirely
 * pages that render a hundred. Measured against a production build:
 *
 * | prefetched route | payload | cacheable? |
 * |---|---|---|
 * | `/app/person/[id]` | **172 KB** | `s-maxage=86400` |
 * | `/app/tv/[id]` | 128 KB | `s-maxage=21600` |
 * | `/app/movie/[id]` | 112 KB | `s-maxage=86400` |
 * | `/app/profile/[id]` | 15.6 KB | **`no-store`** |
 * | `/app/browse`, `/app`, `/app/tonight`, `/app/search/[q]` | ~15.6 KB each | **`no-store`** |
 *
 * The `no-store` rows are the expensive ones: every one of those is a function
 * invocation plus Fast Origin Transfer, per link, per viewport. A home feed of
 * twenty rows carries roughly forty profile links — forty invocations to render
 * one screen the reader has not clicked anything on. The cached rows are
 * cheaper per hit but far larger, and a TV cast page emits ~400 links into
 * `/app/person/[id]`: scrolling it could pull megabytes of payloads for pages
 * nobody opens. Edge Requests were at 964K against a 1M limit in the August
 * window, and this is the traffic that fills that meter.
 *
 * ── Why off by default rather than tuned per link ──────────────────────────
 * Prefetching pays off where intent is high and the link count is low: the
 * header, a hero call-to-action, the one button a page is about. It loses
 * everywhere else, and "everywhere else" is the default case — so that is where
 * the default should sit. Anything that genuinely wants it says `prefetch`
 * explicitly, which also makes the cost visible at the call site.
 *
 * Navigation itself is unaffected. The detail pages are ISR-cached
 * (`s-maxage=86400`), so a click still lands on a CDN copy; what stops is
 * fetching them for the 95% of cards nobody clicks.
 *
 * Not a client component on purpose: adding `"use client"` here would drag
 * every server component that links anywhere into the client bundle.
 */
export default function AppLink({ prefetch = false, ...rest }: AppLinkProps) {
  return <NextLink prefetch={prefetch} {...rest} />;
}
