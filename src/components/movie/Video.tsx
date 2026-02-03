// components/Video.tsx
"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

interface VideoItem {
  id: string;
  key: string;
  name: string;
  type: string;
}

interface VideoProps {
  videos: VideoItem[];
  movie: {
    title?: string;
    name?: string;
  };
}

const VIDEO_CARD_WIDTH = 320;
const GAP = 16;

function Video({ videos, movie }: VideoProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const trailers = useMemo(
    () => videos.filter((item) => item.type === "Trailer"),
    [videos]
  );

  const handleScroll = () => {
    const element = scrollRef.current;
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({
      left: -(VIDEO_CARD_WIDTH + GAP),
      behavior: "smooth",
    });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({
      left: VIDEO_CARD_WIDTH + GAP,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      setTimeout(handleScroll, 100); // Initial check
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [videos]);

  if (trailers.length === 0) return null;

  return (
    <section className="max-w-6xl w-full mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold text-white mb-4">Videos</h2>
      <div className="relative overflow-hidden">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 py-2 overflow-x-auto no-scrollbar pb-1"
        >
          {trailers.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="shrink-0 w-[min(320px,85vw)] rounded-xl border border-neutral-700 bg-neutral-800/80 overflow-hidden"
            >
              <iframe
                className="w-full aspect-video"
                src={`https://www.youtube.com/embed/${item.key}`}
                title={item.name}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <p className="p-2.5 text-sm font-medium text-neutral-200 line-clamp-2">
                {item.name}
              </p>
            </div>
          ))}
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
            onClick={scrollLeft}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2.5 rounded-full hover:bg-neutral-700 transition-colors duration-200 z-10 shadow-lg items-center justify-center"
            aria-label="Scroll videos left"
          >
            <FaChevronLeft size={18} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={scrollRight}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-neutral-800 text-neutral-100 p-2.5 rounded-full hover:bg-neutral-700 transition-colors duration-200 z-10 shadow-lg items-center justify-center"
            aria-label="Scroll videos right"
          >
            <FaChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

export default Video;
