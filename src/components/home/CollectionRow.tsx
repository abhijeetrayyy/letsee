"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "@components/cards/MediaCard";

interface Item {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

export default function CollectionRow({
  items, label, mediaType, showRank,
}: {
  items: Item[];
  label?: string;
  mediaType?: string;
  showRank?: boolean;
  accent?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, [items]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: 320 * dir, behavior: "smooth" });
  };

  if (!items.length) return null;

  return (
    <div className="relative">
      {label && (
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-[0.15em] mb-3">{label}</h3>
      )}

      <div className="relative group/row">
        {canScrollLeft && (
          <button onClick={() => scroll(-1)} className="absolute left-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-surface-950/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity" aria-label="Scroll left">
            <ChevronLeft className="size-5 text-white/80" />
          </button>
        )}

        <div ref={scrollRef} className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1">
          {items.map((item, i) => {
            const title = item.title ?? item.name ?? "Untitled";
            const type = (mediaType ?? item.media_type ?? "movie") as "movie" | "tv";
            const year = item.release_date ?? item.first_air_date;
            const yearStr = year ? String(new Date(year).getFullYear()) : null;

            return (
              <div key={item.id} className="shrink-0 w-[140px] sm:w-[160px] relative">
                {showRank && (
                  <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-lg bg-black/70 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-white border border-white/10">
                    {i + 1}
                  </div>
                )}
                <MediaCard
                  id={item.id}
                  title={title}
                  mediaType={type}
                  posterPath={item.poster_path ?? undefined}
                  rating={item.vote_average ?? undefined}
                  year={yearStr}
                  showActions
                />
              </div>
            );
          })}
        </div>

        {canScrollRight && (
          <button onClick={() => scroll(1)} className="absolute right-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-surface-950/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity" aria-label="Scroll right">
            <ChevronRight className="size-5 text-white/80" />
          </button>
        )}
      </div>
    </div>
  );
}
