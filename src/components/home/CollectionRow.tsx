"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Film, Tv, Star } from "lucide-react";

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
  items,
  label,
  mediaType,
  showRank,
  accent = "brand",
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
        {/* Left scroll */}
        {canScrollLeft && (
          <button
            onClick={() => scroll(-1)}
            className="absolute left-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-surface-950/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-5 text-white/80" />
          </button>
        )}

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-none pb-2 -mx-1 px-1"
        >
          {items.map((item, i) => {
            const title = item.title ?? item.name ?? "Untitled";
            const type = mediaType ?? item.media_type ?? "movie";
            const poster = item.poster_path
              ? `https://image.tmdb.org/t/p/w342${item.poster_path}`
              : null;
            const year = item.release_date ?? item.first_air_date;
            const yearStr = year ? new Date(year).getFullYear() : null;

            return (
              <Link
                key={item.id}
                href={`/app/${type === "tv" ? "tv" : "movie"}/${item.id}`}
                className="shrink-0 w-[140px] sm:w-[160px] group/card"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-800 border border-surface-800/50 group-hover/card:border-brand-500/30 transition-all group-hover/card:-translate-y-1">
                  {poster ? (
                    <img
                      src={poster}
                      alt={title}
                      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-800">
                      {type === "tv" ? <Tv className="size-8 text-surface-600" /> : <Film className="size-8 text-surface-600" />}
                    </div>
                  )}

                  {showRank && (
                    <div className="absolute top-2 left-2 w-6 h-6 rounded-lg bg-black/70 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-white border border-white/10">
                      {i + 1}
                    </div>
                  )}

                  {item.vote_average != null && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-accent-gold">
                      <Star className="size-2.5 fill-current" />
                      {item.vote_average.toFixed(1)}
                    </div>
                  )}
                </div>

                <p className="mt-2 text-xs font-medium text-surface-300 line-clamp-2 group-hover/card:text-white transition-colors leading-snug">
                  {title}
                </p>
                {yearStr && (
                  <p className="text-[10px] text-surface-500 mt-0.5">{yearStr}</p>
                )}
              </Link>
            );
          })}
        </div>

        {/* Right scroll */}
        {canScrollRight && (
          <button
            onClick={() => scroll(1)}
            className="absolute right-0 top-0 bottom-0 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-surface-950/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-5 text-white/80" />
          </button>
        )}
      </div>
    </div>
  );
}
