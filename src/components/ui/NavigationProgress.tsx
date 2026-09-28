"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const NAVIGATION_START_EVENT = "letsee:navigation-start";

/**
 * Tell the global progress indicator about navigations started with
 * `router.push()`. Normal links are detected automatically.
 */
export function announceNavigationStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
  }
}

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;
  const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return false;

  const current = new URL(window.location.href);
  return !(
    destination.pathname === current.pathname &&
    destination.search === current.search &&
    destination.hash === current.hash
  );
}

/**
 * Immediate feedback while the App Router waits for an RSC response.
 *
 * Disabling viewport prefetch stopped speculative requests, but it also made a
 * cold click look broken: the old page stayed completely still for several
 * seconds. This bar is intentionally global so every current and future route
 * has feedback, including links that do not have a colocated loading.tsx.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [pending, setPending] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = () => {
      if (showTimer.current) clearTimeout(showTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);

      // Fast cached transitions need no flash. A genuinely waiting route gets
      // a visible response after one tenth of a second.
      showTimer.current = setTimeout(() => setPending(true), 100);
      safetyTimer.current = setTimeout(() => setPending(false), 15_000);
    };

    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) start();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_START_EVENT, start);
      if (showTimer.current) clearTimeout(showTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    const id = setTimeout(() => setPending(false), 0);
    return () => clearTimeout(id);
  }, [routeKey]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] overflow-hidden transition-opacity duration-150 ${
        pending ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="navigation-progress h-full w-2/5 rounded-r-full bg-brand-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]" />
    </div>
  );
}
