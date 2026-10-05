"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clearPendingNavigation, usePendingNavigation } from "@/lib/nav/pendingNavigation";
import RouteSkeleton from "@components/ui/RouteSkeleton";

/**
 * The next page's shape, over this one, from the moment a link is tapped
 * until the next page arrives.
 *
 * It covers the page rather than replacing it. The page underneath keeps its
 * place, so the browser saves the scroll position you left it at and Back
 * returns you there — hiding it, or scrolling it to the top to show the
 * skeleton, would save the top instead. Between the bars (z-40 and z-50 sit
 * above it) and padded clear of them, so the shell stays put and only the page
 * changes, the way a native app pushes a screen.
 *
 * It goes the moment the path changes: the new page (or its own loading.tsx,
 * which draws the same shape) is already there. A navigation that dies without
 * the path changing gives up after a while (lib/nav/pendingNavigation).
 */
export default function PendingNavigation() {
  const pathname = usePathname();
  const pending = usePendingNavigation(pathname);

  // The path moved on: whatever was pending from the old one is done.
  useEffect(() => {
    clearPendingNavigation();
  }, [pathname]);

  // Back to a page from the browser's cache: it was saved mid-wait.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) clearPendingNavigation();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (!pending?.shown) return null;
  const variant = pending.kind === "page" ? "grid" : pending.kind;
  return (
    <div className="fixed inset-0 z-35 overflow-y-auto overscroll-contain bg-page pb-14 pt-14 md:pb-0">
      <RouteSkeleton variant={variant} hint={pending.hint} />
    </div>
  );
}
