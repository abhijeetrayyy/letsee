"use client";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";
import { Video as VideoIcon } from "lucide-react";

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
      setTimeout(handleScroll, 100);
      return () => element.removeEventListener("scroll", handleScroll);
    }
  }, [videos]);

  if (trailers.length === 0) return null;

  return (
    <section className="section-container section-spacing animate-fade-up">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <div>
          <h2 className="section-header">Trailers & Videos</h2>
          <p className="section-desc">{trailers.length} video{trailers.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="relative overflow-hidden">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 py-2 overflow-x-auto no-scrollbar pb-1"
        >
          {trailers.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className="shrink-0 w-[min(320px,85vw)] rounded-xl glass-card overflow-hidden hover:border-surface-600/50 transition-all duration-300"
            >
              <div className="relative aspect-video bg-surface-900">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${item.key}`}
                  title={item.name}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-surface-100 line-clamp-2 leading-snug">
                  {item.name}
                </p>
              </div>
            </div>
          ))}
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
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 glass-elevated text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all duration-200 z-10 shadow-lg items-center justify-center"
            aria-label="Scroll videos left"
          >
            <FaChevronLeft size={16} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={scrollRight}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 glass-elevated text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all duration-200 z-10 shadow-lg items-center justify-center"
            aria-label="Scroll videos right"
          >
            <FaChevronRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

export default Video;
