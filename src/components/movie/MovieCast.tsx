"use client";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

const CARD_WIDTH = 140;

function MovieCast({
  credits,
  id,
  type,
}: {
  credits: any[];
  id: string;
  type: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -(CARD_WIDTH + 16), behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: CARD_WIDTH + 16, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      handleScroll();
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [credits]);

  const castList = credits?.slice(0, 8) ?? [];

  return (
    <section className="max-w-6xl w-full mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold text-white mb-4">Cast</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
        >
          {castList.map((item: any, index: number) => (
            <Link
              title={item.name}
              key={item.id ?? index}
              href={`/app/person/${item.id}-${item.name
                .trim()
                .replace(/[^a-zA-Z0-9]/g, "-")
                .replace(/-+/g, "-")}`}
              className="shrink-0 snap-start flex flex-col items-center group rounded-xl border border-neutral-700 bg-neutral-800/60 overflow-hidden hover:border-neutral-500 hover:shadow-lg transition-all duration-200 w-[140px]"
            >
              {item.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${item.profile_path}`}
                  alt={item.name}
                  className="w-full aspect-2/3 object-cover group-hover:scale-[1.02] transition-transform duration-200"
                />
              ) : (
                <div className="w-full aspect-2/3 bg-neutral-700 flex items-center justify-center">
                  <span className="text-xs text-neutral-400">No image</span>
                </div>
              )}
              <div className="w-full p-2.5 text-center min-h-16 flex flex-col justify-center">
                <p className="text-sm font-medium text-neutral-100 line-clamp-2">
                  {item.name}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                  {item.character}
                </p>
              </div>
            </Link>
          ))}
          <div className="shrink-0 w-[140px] snap-start flex flex-col">
            <Link
              href={`/app/${type === "movie" ? "movie" : "tv"}/${id}/cast`}
              className="flex flex-col justify-center items-center w-full h-full min-h-[280px] rounded-xl border border-neutral-600 bg-neutral-800/60 hover:border-neutral-500 hover:bg-neutral-700/80 text-neutral-200 text-sm font-medium transition-all duration-200"
            >
              <span className="mt-auto mb-auto">View full cast</span>
            </Link>
          </div>
        </div>

        {/* Fade overlays when scrollable */}
        <div
          className={`hidden md:block absolute top-0 left-0 h-full w-12 sm:w-16 bg-gradient-to-r from-neutral-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`hidden md:block absolute top-0 right-0 h-full w-12 sm:w-16 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />

        {canScrollLeft && (
          <button
            type="button"
            onClick={scrollLeft}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-white p-2.5 rounded-full hover:bg-neutral-700 transition-colors duration-200 shadow-lg z-10"
            aria-label="Scroll cast left"
          >
            <FaChevronLeft size={18} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={scrollRight}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-white p-2.5 rounded-full hover:bg-neutral-700 transition-colors duration-200 shadow-lg z-10"
            aria-label="Scroll cast right"
          >
            <FaChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

export default MovieCast;
