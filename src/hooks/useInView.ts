"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Has this element been scrolled to yet?
 *
 * ── Why anything below the fold should be asking ───────────────────────────
 * A title page fires its data on mount, all of it, whether or not the reader
 * ever gets that far down. The Room alone is nine queries — two of them
 * aggregates over `user_ratings` for the whole title — and it sits under the
 * synopsis, the cast row, the trailers and the composer. Most visits to a film
 * page are someone checking a runtime or a poster; they never see it.
 *
 * That work is not free on either side of the bill. It is Supabase compute on a
 * shared instance, where an expensive query nobody reads makes every *other*
 * query slower, and it is latency on the page's own first paint, competing for
 * the same connection as the things that are actually on screen.
 *
 * So: the component mounts, renders its placeholder, and asks for nothing until
 * it is approached. `rootMargin` starts the fetch a screen early, which is far
 * enough that the data is there before the reader is.
 *
 * One-shot on purpose — once seen, it stays true. A section that unsubscribed
 * on scroll-away would re-fetch every time it crossed the viewport, which is
 * more requests than never having deferred at all.
 */
export function useInView<T extends Element = HTMLDivElement>(
  rootMargin = "600px",
): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (very old browsers, some test environments) means
    // the section would never load at all. Failing open costs a request; failing
    // closed costs the feature.
    //
    // Deferred to a microtask rather than set inline: a synchronous setState in
    // an effect body is a cascading render, and it cannot be hoisted into
    // `useState`'s initialiser either — that runs on the server too, where
    // `IntersectionObserver` is always undefined, so the server would render
    // every deferred section as visible and hydration would disagree.
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setInView(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
