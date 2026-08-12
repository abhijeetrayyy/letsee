"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Play, Star, ChevronLeft, ChevronRight } from "lucide-react";

interface HeroItem {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  overview?: string;
}

export default function HomeHero({ items }: { items: HeroItem[] }) {
  const valid = items.filter((m) => m.id && (m.backdrop_path || m.poster_path)).slice(0, 6);
  const [current, setCurrent] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const next = useCallback(() => {
    if (valid.length <= 1) return;
    setCurrent((c) => (c + 1) % valid.length);
  }, [valid.length]);

  const prev = useCallback(() => {
    if (valid.length <= 1) return;
    setCurrent((c) => (c - 1 + valid.length) % valid.length);
  }, [valid.length]);

  // Auto-rotate every 8 seconds
  useEffect(() => {
    if (valid.length <= 1) return;
    const t = setInterval(next, 8000);
    return () => clearInterval(t);
  }, [next, valid.length]);

  if (!valid.length) return null;

  const item = valid[current];
  const title = item.title ?? item.name ?? "Untitled";
  const mediaType = item.media_type === "tv" ? "tv" : "movie";
  const backdrop = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
    : item.poster_path
      ? `https://image.tmdb.org/t/p/w780${item.poster_path}`
      : null;

  return (
    <div
      className="relative w-full h-[55vh] sm:h-[65vh] min-h-[420px] max-h-[700px] overflow-hidden bg-surface-950 group"
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart == null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 60) diff > 0 ? next() : prev();
        setTouchStart(null);
      }}
    >
      {/* Background image with gradient overlay */}
      <div className="absolute inset-0 transition-all duration-1000 ease-out">
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            className="w-full h-full object-cover object-top"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-800 via-surface-900 to-surface-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-surface-950/95 via-surface-950/60 to-surface-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/20 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="relative h-full max-w-[1400px] mx-auto px-6 lg:px-12 flex items-end pb-12 sm:pb-16">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-medium mb-4">
            <Play className="size-3 fill-current" />
            {current + 1} of {valid.length}
          </div>

          <Link href={`/app/${mediaType}/${item.id}`}>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight hover:text-brand-400 transition-colors">
              {title}
            </h2>
          </Link>

          {item.overview && (
            <p className="mt-3 text-sm sm:text-base text-surface-300 line-clamp-2 leading-relaxed max-w-lg">
              {item.overview}
            </p>
          )}

          <div className="flex items-center gap-4 mt-4">
            {item.vote_average != null && (
              <div className="flex items-center gap-1.5">
                <Star className="size-4 text-accent-gold fill-accent-gold" />
                <span className="text-white font-semibold text-sm">{item.vote_average.toFixed(1)}</span>
              </div>
            )}
            <Link
              href={`/app/${mediaType}/${item.id}`}
              className="btn-primary text-sm px-5 py-2.5"
            >
              View details
            </Link>
          </div>
        </div>
      </div>

      {/* Nav arrows */}
      {valid.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/30 hover:bg-black/50 text-white/70 hover:text-white backdrop-blur-sm transition-all hidden md:flex opacity-0 group-hover:opacity-100"
            aria-label="Previous"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-black/30 hover:bg-black/50 text-white/70 hover:text-white backdrop-blur-sm transition-all hidden md:flex opacity-0 group-hover:opacity-100"
            aria-label="Next"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {valid.length > 1 && (
        <div className="absolute bottom-4 right-6 lg:right-12 flex gap-2 z-10">
          {valid.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-brand-500 w-6" : "bg-white/30 hover:bg-white/50"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
