"use client";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

function tvGenre({ tvGenres }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollLeft = () => {
    const element = scrollRef.current;
    if (element) {
      const itemWidth =
        element.querySelector(".card-item")?.clientWidth || 200;
      const shift = window.innerWidth < 640 ? itemWidth * 2 : itemWidth * 3;
      element.scrollBy({ left: -shift, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    const element = scrollRef.current;
    if (element) {
      const itemWidth =
        element.querySelector(".card-item")?.clientWidth || 200;
      const shift = window.innerWidth < 640 ? itemWidth * 2 : itemWidth * 3;
      element.scrollBy({ left: shift, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      setTimeout(handleScroll, 100);
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [tvGenres]);

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="relative flex flex-row overflow-x-auto no-scrollbar gap-2.5 py-2 z-10 pretty-scrollbar"
      >
        {tvGenres.map((genreItem: any) => (
          <Link
            href={`/app/tvbygenre/list/${genreItem.id}-${genreItem.name}`}
            className="card-item h-20 sm:h-24 min-w-28 sm:min-w-36 md:min-w-44 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-surface-800/60 border border-surface-700/40 hover:bg-surface-700/80 hover:border-surface-600/60 transition-all duration-200"
            key={genreItem.id}
          >
            <span className="text-surface-200 text-sm sm:text-base md:text-lg font-semibold drop-shadow-md hover:text-white transition-colors">
              {genreItem.name}
            </span>
          </Link>
        ))}
      </div>

      <div
        className={`hidden md:block absolute top-0 left-0 h-full w-12 bg-gradient-to-r from-surface-950 to-transparent pointer-events-none transition-opacity duration-300 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`hidden md:block absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-surface-950 to-transparent pointer-events-none transition-opacity duration-300 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      />

      {canScrollLeft && (
        <button
          onClick={scrollLeft}
          className="hidden md:flex absolute left-2 top-1/2 transform -translate-y-1/2 bg-surface-800/90 backdrop-blur-sm text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all duration-200 z-10 shadow-lg shadow-black/20 opacity-0 group-hover:opacity-100 items-center justify-center"
          aria-label="Scroll left"
        >
          <FaChevronLeft size={14} />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="hidden md:flex absolute right-2 top-1/2 transform -translate-y-1/2 bg-surface-800/90 backdrop-blur-sm text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all duration-200 z-10 shadow-lg shadow-black/20 opacity-0 group-hover:opacity-100 items-center justify-center"
          aria-label="Scroll right"
        >
          <FaChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

export default tvGenre;
