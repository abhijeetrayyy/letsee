"use client";

import { useEffect, useRef, useState } from "react";
import Lightbox from "@components/ui/Lightbox";

/**
 * Portraits, with a lightbox and without the count lie.
 *
 * Every profile TMDB holds is portrait-shaped — aspect_ratio lands in
 * 0.665–0.672 on 100% of rows across the sample — so a uniform 2:3 grid is
 * correct and no masonry is needed. The header count is the rendered count;
 * the old component announced a number it then didn't show.
 */
export default function PersonPortraits({
  name,
  profiles,
}: {
  name: string;
  profiles: { file_path: string; width?: number; height?: number }[];
}) {
  const [index, setIndex] = useState<number | null>(null);
  const PAGE_SIZE = 24;
  // Portraits sit after the complete body of work. Rendering even the first
  // two dozen into the route payload delays the hero for content several
  // screens away, so the observer brings them in as the reader approaches.
  const [visibleCount, setVisibleCount] = useState(0);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const hasMore = visibleCount < profiles.length;

  useEffect(() => {
    if (!hasMore || !moreRef.current || typeof IntersectionObserver === "undefined") return;
    const node = moreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, profiles.length));
          observer.disconnect();
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, profiles.length, visibleCount]);

  if (profiles.length < 4) return null;

  const images = profiles.map((p) => ({
    src: `https://image.tmdb.org/t/p/original${p.file_path}`,
    alt: name,
  }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {profiles.slice(0, visibleCount).map((p, i) => (
          <button
            key={p.file_path}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`${name}, portrait ${i + 1} of ${profiles.length}`}
            className="group aspect-[2/3] overflow-hidden rounded-lg bg-surface-800 ring-1 ring-surface-700/40 transition hover:ring-brand-500/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://image.tmdb.org/t/p/w185${p.file_path}`}
              srcSet={`https://image.tmdb.org/t/p/w185${p.file_path} 185w, https://image.tmdb.org/t/p/h632${p.file_path} 421w`}
              sizes="(min-width: 1024px) 210px, (min-width: 640px) 23vw, 45vw"
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          ref={moreRef}
          type="button"
          onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, profiles.length))}
          className="mx-auto mt-6 block rounded-full border border-surface-700 bg-surface-900 px-5 py-2 text-sm text-surface-300 transition-colors hover:border-brand-500/40 hover:text-white"
        >
          Show more portraits <span className="text-surface-500">({profiles.length - visibleCount} left)</span>
        </button>
      )}
      <Lightbox images={images} index={index} onClose={() => setIndex(null)} onIndexChange={setIndex} />
    </>
  );
}
