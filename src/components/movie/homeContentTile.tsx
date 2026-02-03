"use client";

import React, { useState, useEffect, useRef } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { GenreList } from "@/staticData/genreList";
import MediaCard from "@components/cards/MediaCard";
import SendMessageModal from "@components/message/sendCard";

export default function HomeContentTile({ data, type }: { data: { results?: any[] }; type: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [itemWidth, setItemWidth] = useState(160);

  const handleCardTransfer = (item: any) => {
    setCardData(item);
    setIsModalOpen(true);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scroll = (dir: number) => {
    const el = scrollRef.current;
    if (el) {
      const w = el.querySelector(".image-item")?.clientWidth ?? itemWidth + 16;
      el.scrollBy({ left: w * 2 * dir, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const containerWidth = el.clientWidth;
    const gap = 16;
    const peek = containerWidth * 0.15;
    let perView = Math.floor((containerWidth - peek) / (160 + gap));
    if (perView < 2) perView = 2;
    const w = (containerWidth - peek - gap * perView) / perView;
    setItemWidth(w);
  }, [data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    const t = setTimeout(handleScroll, 100);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(t);
    };
  }, [data]);

  const results = (data?.results ?? []).filter(
    (item: any) => item.media_type !== "person"
  );

  return (
    <div className="w-full md:px-4 md:mb-5">
      <SendMessageModal
        media_type={type !== "mix" ? type : cardData?.media_type}
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 py-3 overflow-x-auto no-scrollbar pb-1"
        >
          {results.length > 0 ? (
            results.map((item: any) => {
              const mediaType = type === "mix" ? item.media_type : type;
              const genreIds = item.genre_ids ?? [];
              const genres = genreIds
                .map((id: number) => GenreList.genres.find((g: any) => g.id === id)?.name)
                .filter(Boolean);
              const year =
                item.release_date || item.first_air_date
                  ? String(new Date(item.release_date || item.first_air_date).getFullYear())
                  : null;

              return (
                <MediaCard
                  key={item.id}
                  id={item.id}
                  title={item.name || item.title}
                  mediaType={mediaType}
                  posterPath={item.poster_path}
                  adult={item.adult}
                  genres={genres}
                  showActions
                  onShare={(e) => {
                    e.preventDefault();
                    handleCardTransfer(item);
                  }}
                  typeLabel={type === "mix" ? item.media_type : type}
                  year={year}
                  className="card-item image-item"
                  style={{ width: itemWidth }}
                />
              );
            })
          ) : (
            <p className="text-neutral-400 text-center w-full py-4">
              No titles available
            </p>
          )}
        </div>

        <div
          className={`hidden md:block absolute top-0 left-0 h-full w-12 sm:w-20 bg-gradient-to-r from-neutral-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`hidden md:block absolute top-0 right-0 h-full w-12 sm:w-20 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />

        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2.5 rounded-full hover:bg-neutral-700 transition-colors z-10 shadow-lg items-center justify-center"
            aria-label="Scroll left"
          >
            <FaChevronLeft size={18} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll(1)}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2.5 rounded-full hover:bg-neutral-700 transition-colors z-10 shadow-lg items-center justify-center"
            aria-label="Scroll right"
          >
            <FaChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
