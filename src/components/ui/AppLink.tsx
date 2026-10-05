"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useRef } from "react";
import { hintFromLink, startPendingNavigation, type NavHint } from "@/lib/nav/pendingNavigation";

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
 * Viewport prefetch remains off, but a deliberate hover, keyboard focus, or
 * touch starts an intent prefetch. That keeps dense grids cheap without making
 * the click itself pay the entire network wait.
 */
export default function AppLink({
  prefetch = false,
  href,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onTouchStart,
  onClick,
  onNavigate,
  ...rest
}: AppLinkProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didPrefetch = useRef(false);
  const tapped = useRef<NavHint | null>(null);
  const target = typeof href === "string" ? href : null;

  const prefetchOnIntent = useCallback(() => {
    if (prefetch || didPrefetch.current || !target || !target.startsWith("/")) return;
    didPrefetch.current = true;
    router.prefetch(target);
  }, [prefetch, router, target]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <NextLink
      {...rest}
      href={href}
      prefetch={prefetch}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (event.defaultPrevented || prefetch) return;
        // Ignore fly-by cursor movement across a dense poster grid. A short,
        // deliberate hover is a much stronger signal than being in viewport.
        timer.current = setTimeout(prefetchOnIntent, 80);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        if (timer.current) clearTimeout(timer.current);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        if (!event.defaultPrevented) prefetchOnIntent();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        if (!event.defaultPrevented) prefetchOnIntent();
      }}
      // What the tapped link shows of its page — the poster, the name — read
      // on the click, before anything moves. Next calls onClick first, then
      // onNavigate only for a navigation it handles itself: not a new tab, a
      // modified click, or a link whose own handler stopped it.
      onClick={(event) => {
        onClick?.(event);
        tapped.current = event.defaultPrevented ? null : hintFromLink(event.currentTarget);
      }}
      onNavigate={(event) => {
        let stopped = false;
        onNavigate?.({
          preventDefault: () => {
            stopped = true;
            event.preventDefault();
          },
        });
        // The next page's shape goes up at once (ui/PendingNavigation).
        if (!stopped && target) startPendingNavigation(target, tapped.current ?? {});
        tapped.current = null;
      }}
    />
  );
}
