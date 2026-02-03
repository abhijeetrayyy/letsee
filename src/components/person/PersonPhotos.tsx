"use client";

import { useRef, useState, useEffect } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

interface ProfileImage {
  file_path: string;
  vote_average?: number;
}

interface PersonPhotosProps {
  /** TMDB person name for alt text */
  name: string;
  /** Profile images from TMDB person images API (profiles array). Sorted by vote_average desc, max 12. */
  profiles: ProfileImage[];
}

export default function PersonPhotos({ name, profiles }: PersonPhotosProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const list = (profiles ?? []).slice(0, 12);
  if (list.length === 0) return null;

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  };

  useEffect(() => {
    handleScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    const t = setTimeout(handleScroll, 100);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(t);
    };
  }, [profiles]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -280 : 280,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative w-full -mx-2 sm:mx-0">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {list.map((profile, i) => {
          const path = profile.file_path?.startsWith("/")
            ? profile.file_path.slice(1)
            : profile.file_path;
          const src = path ? `${TMDB_IMAGE_BASE}/w342/${path}` : null;
          if (!src) return null;
          return (
            <div
              key={`${profile.file_path}-${i}`}
              className="shrink-0 w-40 sm:w-44 rounded-xl overflow-hidden border border-neutral-700/60 bg-neutral-800/50 aspect-[2/3]"
            >
              <img
                src={src}
                alt={`${name} — photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
      <div
        className={`hidden md:block absolute top-0 left-0 bottom-2 w-10 bg-gradient-to-r from-neutral-950 to-transparent pointer-events-none transition-opacity ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`hidden md:block absolute top-0 right-0 bottom-2 w-10 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none transition-opacity ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-neutral-800/95 text-white hover:bg-neutral-700 border border-neutral-600"
          aria-label="Scroll left"
        >
          <FaChevronLeft className="w-4 h-4" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 items-center justify-center rounded-full bg-neutral-800/95 text-white hover:bg-neutral-700 border border-neutral-600"
          aria-label="Scroll right"
        >
          <FaChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
