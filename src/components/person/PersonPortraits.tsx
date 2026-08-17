"use client";

import { useState } from "react";
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
  if (profiles.length < 4) return null;

  const images = profiles.map((p) => ({
    src: `https://image.tmdb.org/t/p/original${p.file_path}`,
    alt: name,
  }));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {profiles.map((p, i) => (
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
      <Lightbox images={images} index={index} onClose={() => setIndex(null)} onIndexChange={setIndex} />
    </>
  );
}
