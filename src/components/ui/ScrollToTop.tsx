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
 *
 * Unless the address names an anchor (`/app/settings#your-data`,
 * `/app/profile/ray#diary`): then it goes to that element instead. Going to the
 * top regardless sent every such link to the top of its page. The element is
 * often not there yet — settings and a profile's folds render after their data
 * arrives — so it is looked for for up to five seconds, and looked at once
 * more a moment after arriving, in case images above it have since loaded and
 * pushed it down (unless the reader has scrolled away themselves by then).
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    const raw = window.location.hash.slice(1);
    let anchor = raw;
    try {
      anchor = decodeURIComponent(raw);
    } catch {
      // A malformed fragment (`#50%`) is used as typed, not allowed to throw
      // out of the root layout.
    }
    if (anchor) {
      let tries = 0;
      let settle: ReturnType<typeof setTimeout> | undefined;
      const startY = window.scrollY;
      const look = setInterval(() => {
        // Someone who has started scrolling while we wait has chosen where to be.
        if (Math.abs(window.scrollY - startY) > 2) {
          clearInterval(look);
          return;
        }
        const el = document.getElementById(anchor);
        if (!el && ++tries < 60) return;
        clearInterval(look);
        if (!el) return;
        // Instant: arriving is not an animation, and the page's smooth
        // scroll-behavior would glide from the top (and not move at all in a
        // background tab, where animations don't run).
        el.scrollIntoView({ block: "start", behavior: "instant" });
        const landed = window.scrollY;
        settle = setTimeout(() => {
          if (Math.abs(window.scrollY - landed) < 2) el.scrollIntoView({ block: "start", behavior: "instant" });
        }, 500);
      }, 80);
      return () => {
        clearInterval(look);
        if (settle) clearTimeout(settle);
      };
    }

    scrollToTop();
    const id = requestAnimationFrame(() => {
      scrollToTop();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
