"use client";

import React, { useEffect, useRef, useState } from "react";
import MediaCard from "@/components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";
import { GenreList } from "@/staticData/genreList";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

/** TMDB combined_credits cast item (pre-sorted as "Known For" on person page). */
interface CastItem {
  id: number | string;
  adult?: boolean;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
}

interface KnowForProps {
  castData: CastItem[] | undefined;
}

export default function KnowFor({ castData }: KnowForProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<CastItem | null>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 8);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
    }
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = el.querySelector(".known-for-item")?.clientWidth ?? 160;
    el.scrollBy({ left: dir === "left" ? -itemWidth * 2 : itemWidth * 2, behavior: "smooth" });
  };

  useEffect(() => {
    handleScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    const t = setTimeout(handleScroll, 150);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(t);
    };
  }, [castData]);

  const list = (castData ?? []).filter((item) => item && !item.adult);
  if (list.length === 0) {
    return (
      <p className="text-neutral-500 text-sm py-6">No notable credits to show.</p>
    );
  }

  return (
    <div className="relative w-full">
      <SendMessageModal
        media_type={cardData?.media_type ?? null}
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div className="relative -mx-2 sm:mx-0">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {list.map((item) => {
            const displayTitle = item.title ?? item.name ?? "";
            const year =
              item.release_date || item.first_air_date
                ? String(new Date((item.release_date ?? item.first_air_date) as string).getFullYear())
                : null;
            const genres = (item.genre_ids ?? [])
              .map((gid) => GenreList.genres.find((g: { id: number }) => g.id === gid)?.name)
              .filter(Boolean) as string[];

            return (
              <div key={`${item.media_type}-${item.id}`} className="known-for-item shrink-0 w-36 sm:w-40 md:w-44 snap-start">
                <MediaCard
                  id={Number(item.id)}
                  title={displayTitle}
                  mediaType={item.media_type === "tv" ? "tv" : "movie"}
                  posterPath={item.poster_path ?? item.backdrop_path}
                  adult={!!item.adult}
                  genres={genres}
                  showActions
                  onShare={() => { setCardData(item); setIsModalOpen(true); }}
                  year={year}
                />
              </div>
            );
          })}
        </div>

        <div
          className={`hidden md:block absolute top-0 left-0 bottom-2 w-12 bg-gradient-to-r from-neutral-950 to-transparent pointer-events-none transition-opacity ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`hidden md:block absolute top-0 right-0 bottom-2 w-12 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none transition-opacity ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-neutral-800/95 text-white hover:bg-neutral-700 border border-neutral-600 shadow-lg"
            aria-label="Scroll left"
          >
            <FaChevronLeft className="w-5 h-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-neutral-800/95 text-white hover:bg-neutral-700 border border-neutral-600 shadow-lg"
            aria-label="Scroll right"
          >
            <FaChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
