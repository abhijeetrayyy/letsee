"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaCard from "@components/cards/MediaCard";
import { GenreList } from "@/staticData/genreList";

interface Item {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  adult?: boolean;
  genre_ids?: number[];
}

function genreNames(ids?: number[]): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => GenreList.genres.find((g) => g.id === id)?.name)
    .filter((name): name is string => Boolean(name));
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
            const type = mediaType ?? item.media_type ?? "movie";
            const year = item.release_date ?? item.first_air_date;
            const yearStr = year ? String(new Date(year).getFullYear()) : null;

            return (
              <MediaCard
                key={item.id}
                id={item.id}
                title={item.title ?? item.name ?? "Untitled"}
                mediaType={type === "tv" ? "tv" : "movie"}
                posterPath={item.poster_path}
                adult={item.adult}
                genres={genreNames(item.genre_ids)}
                rating={item.vote_average}
                year={yearStr}
                rank={showRank ? i + 1 : undefined}
                className="shrink-0 w-[140px] sm:w-[160px]"
              />
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
