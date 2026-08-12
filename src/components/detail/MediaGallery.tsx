"use client";

import { useState } from "react";
import Lightbox from "@components/ui/Lightbox";

type TmdbImage = { file_path: string };

/**
 * Backdrop/poster gallery. Thumbnails are large enough to actually read, and
 * open full-size in a zoomable viewer — previously these were small, static
 * and unclickable, which made the gallery decorative rather than useful.
 */
export default function MediaGallery({
  backdrops = [],
  posters = [],
  title,
}: {
  backdrops?: TmdbImage[];
  posters?: TmdbImage[];
  title: string;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);

  // Backdrops first (they read better as a strip), then posters.
  const images = [
    ...backdrops.slice(0, 12).map((b) => ({ path: b.file_path, wide: true })),
    ...posters.slice(0, 8).map((p) => ({ path: p.file_path, wide: false })),
  ];

  if (images.length === 0) return null;

  const full = images.map((img) => ({
    src: `https://image.tmdb.org/t/p/original${img.path}`,
    alt: title,
  }));

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {images.map((img, i) => (
          <button
            key={img.path}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={`Open image ${i + 1} of ${images.length}`}
            className={`group relative shrink-0 overflow-hidden rounded-xl bg-surface-800 ring-1 ring-surface-700/50 transition-all hover:ring-brand-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              img.wide ? "aspect-video w-[22rem] sm:w-[28rem]" : "aspect-[2/3] w-40 sm:w-48"
            }`}
          >
            <img
              src={`https://image.tmdb.org/t/p/w780${img.path}`}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
          </button>
        ))}
      </div>

      <Lightbox
        images={full}
        index={openAt}
        onClose={() => setOpenAt(null)}
        onIndexChange={setOpenAt}
      />
    </>
  );
}
