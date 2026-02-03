"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function scrollToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Scrolls the window to top whenever the route (pathname) changes.
 * Runs immediately and after paint so we override any delayed scroll restoration.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    scrollToTop();
    const id = requestAnimationFrame(() => {
      scrollToTop();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
