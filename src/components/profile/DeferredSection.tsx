"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers mounting (and therefore fetching) of a profile section until it's
 * about to scroll into view, instead of every section firing its SWR fetch
 * the moment the profile page mounts.
 */
export default function DeferredSection({
  children,
  rootMargin = "600px",
}: {
  children: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref}>
      {visible ? (
        children
      ) : (
        <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 min-h-[200px] animate-pulse" />
      )}
    </div>
  );
}
