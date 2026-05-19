"use client";

import React, { useState, useEffect, useRef } from "react";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

type BecauseItem = {
  id: string;
  title: string;
  mediaType: string;
  posterUrl: string | null;
  year: string;
  voteAverage: number;
  matchScore: number;
  matchReason: string;
};

type BecauseResponse = {
  results: BecauseItem[];
  total: number;
};

export default function BecauseYouWatched({
  itemId,
  mediaType,
  sectionTitle,
}: {
  itemId: string;
  mediaType: "movie" | "tv";
  sectionTitle?: string;
}) {
  const [items, setItems] = useState<BecauseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [itemWidth, setItemWidth] = useState(200);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/recommendations/because-you-watched?itemId=${itemId}&mediaType=${mediaType}`)
      .then((r) => r.json())
      .then((data: BecauseResponse) => {
        if (mounted) {
          setItems(data.results ?? []);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) setError("Failed to load");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [itemId, mediaType]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 0);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
    }
  };

  const scroll = (dir: number) => {
    const el = scrollRef.current;
    if (el) {
      const w = el.querySelector(".card-item")?.clientWidth ?? itemWidth + 16;
      el.scrollBy({ left: w * 2 * dir, behavior: "smooth" });
    }
  };

  useEffect(() => {
    const calculateWidth = () => {
      const el = scrollRef.current;
      if (!el) return;
      const containerWidth = el.clientWidth;
      const gap = 16;
      const peek = containerWidth * 0.15;
      let perView = Math.floor((containerWidth - peek) / (200 + gap));
      if (perView < 2) perView = 2;
      setItemWidth((containerWidth - peek - gap * perView) / perView);
    };
    calculateWidth();
    window.addEventListener("resize", calculateWidth);
    return () => window.removeEventListener("resize", calculateWidth);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll);
      setTimeout(handleScroll, 100);
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [items]);

  if (loading) {
    return (
      <section className="max-w-6xl w-full mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          {sectionTitle ?? "Because you watched"}
        </h2>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="md" className="border-t-white shrink-0" />
        </div>
      </section>
    );
  }

  if (error || items.length === 0) return null;

  return (
    <section className="max-w-6xl w-full mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold text-white mb-4">
        {sectionTitle ?? "Because you watched"}
      </h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 py-2 overflow-x-auto no-scrollbar pb-1"
          onScroll={handleScroll}
        >
          {items.map((item) => (
            <div key={`${item.mediaType}:${item.id}`} className="relative shrink-0 card-item">
              <MediaCard
                id={Number(item.id)}
                title={item.title}
                mediaType={item.mediaType as "movie" | "tv"}
                imageUrl={item.posterUrl}
                adult={false}
                genres={[]}
                showActions
                typeLabel={item.mediaType}
                style={{ width: `${itemWidth}px` }}
              />
              <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-accent-gold">
                {item.voteAverage.toFixed(1)}
              </div>
              <div className="absolute bottom-1 left-1 right-1">
                <div className={`text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm truncate text-center ${
                  item.matchScore >= 70
                    ? "bg-green-500/70 text-white"
                    : item.matchScore >= 40
                      ? "bg-yellow-500/70 text-black"
                      : "bg-surface-800/70 text-surface-300"
                }`}>
                  {item.matchReason}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={`hidden md:block absolute top-0 left-0 h-full w-12 sm:w-20 bg-gradient-to-r from-surface-950 to-transparent pointer-events-none transition-opacity ${canScrollLeft ? "opacity-100" : "opacity-0"}`} />
        <div className={`hidden md:block absolute top-0 right-0 h-full w-12 sm:w-20 bg-gradient-to-l from-surface-950 to-transparent pointer-events-none transition-opacity ${canScrollRight ? "opacity-100" : "opacity-0"}`} />

        {canScrollLeft && (
          <button onClick={() => scroll(-1)} className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 bg-surface-800 text-surface-100 p-2.5 rounded-full hover:bg-surface-700 transition-colors z-10 shadow-lg items-center justify-center" aria-label="Scroll left">
            <FaChevronLeft size={18} />
          </button>
        )}
        {canScrollRight && (
          <button onClick={() => scroll(1)} className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 bg-surface-800 text-surface-100 p-2.5 rounded-full hover:bg-surface-700 transition-colors z-10 shadow-lg items-center justify-center" aria-label="Scroll right">
            <FaChevronRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
