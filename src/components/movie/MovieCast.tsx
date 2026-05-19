"use client";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { Users } from "lucide-react";

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
    <section className="section-container section-spacing animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <div>
          <h2 className="section-header">Cast</h2>
          <p className="section-desc">Actors and characters</p>
        </div>
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2"
        >
          {castList.map((item: any, index: number) => (
            <Link
              title={item.name}
              key={item.id ?? index}
              href={`/app/person/${item.id}-${item.name.trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
              className="shrink-0 snap-start flex flex-col items-center group rounded-xl glass-card overflow-hidden hover:border-surface-600/50 hover:-translate-y-1 transition-all duration-300 w-[140px]"
            >
              {item.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${item.profile_path}`}
                  alt={item.name}
                  className="w-full aspect-[2/3] object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-surface-800 flex items-center justify-center">
                  <Users className="w-6 h-6 text-surface-600" />
                </div>
              )}
              <div className="w-full p-2.5 text-center min-h-[60px] flex flex-col justify-center">
                <p className="text-sm font-semibold text-surface-100 line-clamp-2 group-hover:text-brand-400 transition-colors">
                  {item.name}
                </p>
                <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-2 leading-tight">
                  {item.character}
                </p>
              </div>
            </Link>
          ))}
          <div className="shrink-0 w-[140px] snap-start">
            <Link
              href={`/app/${type === "movie" ? "movie" : "tv"}/${id}/cast`}
              className="flex flex-col justify-center items-center w-full h-full min-h-[290px] rounded-xl glass-card border-dashed border-surface-600/40 hover:border-surface-500/60 hover:bg-surface-800/60 text-surface-300 text-sm font-medium transition-all duration-200 group"
            >
              <span className="text-2xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">→</span>
              <span className="group-hover:text-white transition-colors">View full cast</span>
            </Link>
          </div>
        </div>

        <div
          className={`hidden md:block absolute top-0 left-0 h-full w-16 bg-gradient-to-r from-surface-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`hidden md:block absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-surface-950 to-transparent pointer-events-none transition-opacity duration-300 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />

        {canScrollLeft && (
          <button
            type="button"
            onClick={scrollLeft}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 glass-elevated text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all duration-200 shadow-lg z-10"
            aria-label="Scroll cast left"
          >
            <FaChevronLeft size={16} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={scrollRight}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 glass-elevated text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all duration-200 shadow-lg z-10"
            aria-label="Scroll cast right"
          >
            <FaChevronRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

export default MovieCast;
