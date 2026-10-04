"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A poster row with arrows at the ends that have more.
 *
 * Wrap the row's scroller (the element with `overflow-x-auto`) in this. Every
 * scroller already fades at an edge with more beyond it (globals.css, a
 * scroll-driven mask);
 * but a fade alone is easy to miss, a mouse can't swipe, and shift-scrolling
 * is something nobody knows. So a round arrow sits at each end that has more
 * — small on a touch screen, over the faded edge, full size with a pointer —
 * and a tap or click moves the row about a screen's width. Hidden from the
 * keyboard: Tab already walks the row and scrolls it as it goes.
 */
const SLACK = 2;

export default function Rail({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ start: false, end: false });

  const scroller = () => wrap.current?.querySelector<HTMLElement>(".overflow-x-auto, [data-rail]") ?? null;

  useEffect(() => {
    const el = scroller();
    if (!el) return;
    const read = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { start: max > SLACK && el.scrollLeft > SLACK, end: max > SLACK && max - el.scrollLeft > SLACK };
      setMore((cur) => (cur.start === next.start && cur.end === next.end ? cur : next));
    };
    const first = requestAnimationFrame(read);
    el.addEventListener("scroll", read, { passive: true });
    const resized = new ResizeObserver(read);
    resized.observe(el);
    const changed = new MutationObserver(read);
    changed.observe(el, { childList: true });
    return () => {
      cancelAnimationFrame(first);
      el.removeEventListener("scroll", read);
      resized.disconnect();
      changed.disconnect();
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const el = scroller();
    if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  };

  // Smaller on a touch screen, where it sits over the faded edge as a sign
  // (and still works as a tap); full size where there's a pointer.
  const arrow =
    "absolute top-[38%] z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-overlay/95 text-ink-0 shadow-lg ring-1 ring-inset ring-line-strong transition-colors hover:bg-hover pointer-fine:size-10";

  return (
    <div ref={wrap} className="relative">
      {children}
      {more.start && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => go(-1)} className={`${arrow} -left-3`}>
          <ChevronLeft className="size-4 pointer-fine:size-5" />
        </button>
      )}
      {more.end && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => go(1)} className={`${arrow} -right-3`}>
          <ChevronRight className="size-4 pointer-fine:size-5" />
        </button>
      )}
    </div>
  );
}
