"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FetchError } from "@/components/ui/FetchError";
import { Play, Star, Calendar } from "lucide-react";

const IMAGE_BASE = "https://image.tmdb.org/t/p";
const FALLBACK_IMAGE = "/backgroundjpeg.webp";
const HERO_AUTO_ROTATE_MS = 6000;

interface HeroItem {
  id: number;
  title: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
}

function HomeHeroBanner() {
  const [items, setItems] = useState<HeroItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHero = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/homeHero", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Failed to load hero");
      }
      const data = await res.json();
      const valid = (Array.isArray(data) ? data : [])
        .filter((m: HeroItem) => m.id && m.title)
        .slice(0, 10);
      setItems(
        valid.length > 0
          ? valid
          : [
              {
                id: 0,
                title: "No content available",
                poster_path: null,
                backdrop_path: null,
              },
            ]
      );
    } catch (err) {
      setError((err as Error).message ?? "Couldn't load hero");
      setItems([
        {
          id: 0,
          title: "No content available",
          poster_path: null,
          backdrop_path: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHero();
  }, [fetchHero]);

  const next = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    if (items.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    autoRotateRef.current = setInterval(next, HERO_AUTO_ROTATE_MS);
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [items.length, next]);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchMove, setTouchMove] = useState<number | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      setTouchStart(x);
    },
    []
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      setTouchMove(x);
    },
    []
  );

  const onTouchEnd = useCallback(() => {
    if (touchStart != null && touchMove != null) {
      const delta = touchMove - touchStart;
      if (Math.abs(delta) > 50) (delta > 0 ? prev() : next());
    }
    setTouchStart(null);
    setTouchMove(null);
  }, [touchStart, touchMove, prev, next]);

  if (error) {
    return (
      <div className="relative max-w-[1920px] mx-auto w-full rounded-2xl overflow-hidden">
        <FetchError message={error} onRetry={fetchHero} />
      </div>
    );
  }

  const current = items[currentIndex];
  const hasBackdrop = current?.backdrop_path;
  const hasPoster = current?.poster_path;
  const imagePath = hasBackdrop || hasPoster;
  const year = current?.release_date
    ? new Date(current.release_date).getFullYear()
    : null;
  const rating =
    current?.vote_average != null ? current.vote_average.toFixed(1) : null;

  const desktopSrc = imagePath
    ? hasBackdrop
      ? `${IMAGE_BASE}/w1280${current!.backdrop_path}`
      : `${IMAGE_BASE}/w780${current!.poster_path}`
    : FALLBACK_IMAGE;

  const mobileSrc = imagePath
    ? hasPoster
      ? `${IMAGE_BASE}/w500${current!.poster_path}`
      : `${IMAGE_BASE}/w780${current!.backdrop_path}`
    : FALLBACK_IMAGE;

  return (
    <div className="relative max-w-[1920px] mx-auto w-full overflow-hidden">
      <section
        className="relative w-full min-h-[75vw] sm:min-h-[55vw] md:min-h-[45vw] lg:min-h-[36rem] max-h-[85vh] bg-surface-950"
        aria-label="Featured"
        onMouseDown={onTouchStart}
        onMouseMove={onTouchMove}
        onMouseUp={onTouchEnd}
        onMouseLeave={onTouchEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-900">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{ backgroundImage: `url(${FALLBACK_IMAGE})` }}
            />
            <AiOutlineLoading3Quarters className="relative size-12 text-brand-400 animate-spin" />
            <p className="relative text-sm text-surface-500">Loading…</p>
          </div>
        ) : (
          <>
            {/* Background image */}
            <picture className="absolute inset-0 block">
              <source media="(max-width: 767px)" srcSet={mobileSrc} />
              <img
                src={desktopSrc}
                alt={current?.title ?? ""}
                className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700"
                sizes="(max-width: 768px) 100vw, 1280px"
                fetchPriority="high"
              />
            </picture>

            {/* Gradient overlays */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-transparent pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-surface-950/60 via-transparent to-transparent pointer-events-none"
              aria-hidden
            />

            {/* Top badge */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 border border-brand-500/20 px-3 py-1.5 text-xs font-medium text-brand-300 backdrop-blur-md">
                <Play className="w-3 h-3 fill-brand-400" />
                Featured
              </span>
            </div>

            {/* Details overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col gap-3 max-w-3xl">
              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {year != null && (
                  <span className="flex items-center gap-1.5 text-surface-300">
                    <Calendar className="w-3.5 h-3.5 text-surface-500" />
                    {year}
                  </span>
                )}
                {rating != null && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
                    <span className="text-surface-200 font-medium">{rating}</span>
                    <span className="text-surface-500">/10</span>
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
                {current?.id ? (
                  <Link
                    href={`/app/movie/${current.id}`}
                    className="hover:text-brand-400 transition-colors duration-200 focus:outline-none"
                  >
                    {current.title}
                  </Link>
                ) : (
                  <span>{current?.title ?? "—"}</span>
                )}
              </h2>

              {/* Description */}
              <p className="text-surface-400 text-sm sm:text-base max-w-xl leading-relaxed">
                Love stories and feel-good picks — discover more below.
              </p>

              {/* CTA */}
              {current?.id && (
                <Link
                  href={`/app/movie/${current.id}`}
                  className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-semibold text-surface-950 hover:bg-brand-400 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/20"
                >
                  <Play className="w-4 h-4 fill-surface-950" />
                  View Film
                </Link>
              )}
            </div>

            {/* Navigation dots */}
            {items.length > 1 && (
              <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-6">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? "w-8 bg-brand-400"
                        : "w-1.5 bg-white/30 hover:bg-white/50"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Arrow navigation */}
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/30 p-3 text-white backdrop-blur-sm hover:bg-black/50 transition-all md:block"
                  aria-label="Previous"
                >
                  <FaChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/30 p-3 text-white backdrop-blur-sm hover:bg-black/50 transition-all md:block"
                  aria-label="Next"
                >
                  <FaChevronRight size={18} />
                </button>
              </>
            )}
          </>
        )}
      </section>

      {/* Reels CTA strip */}
      <div className="flex items-center justify-between gap-4 bg-surface-900/80 px-4 py-3 sm:px-6 sm:py-3.5 border-t border-surface-800/50">
        <p className="text-sm text-surface-400">
          Short clips by mood and your watchlist.
        </p>
        <Link
          href="/app/reel"
          className="shrink-0 rounded-full bg-surface-800 border border-surface-700 px-4 py-1.5 text-sm font-medium text-surface-300 hover:bg-surface-700 hover:text-white transition-colors"
        >
          Watch Reels
        </Link>
      </div>
    </div>
  );
}

export default HomeHeroBanner;
