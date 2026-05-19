"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FetchError } from "@/components/ui/FetchError";
import { Play, Star, Calendar, Clapperboard } from "lucide-react";

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
  const year = current?.release_date
    ? new Date(current.release_date).getFullYear()
    : null;
  const rating =
    current?.vote_average != null ? current.vote_average.toFixed(1) : null;

  const desktopSrc = hasBackdrop
    ? `${IMAGE_BASE}/w1280${current!.backdrop_path}`
    : hasPoster
    ? `${IMAGE_BASE}/w780${current!.poster_path}`
    : FALLBACK_IMAGE;

  const mobileSrc = hasPoster
    ? `${IMAGE_BASE}/w500${current!.poster_path}`
    : hasBackdrop
    ? `${IMAGE_BASE}/w780${current!.backdrop_path}`
    : FALLBACK_IMAGE;

  return (
    <div className="relative max-w-[1920px] mx-auto w-full overflow-hidden">
      <section
        className="relative w-full min-h-[70vw] sm:min-h-[50vw] md:min-h-[42vw] lg:min-h-[34rem] max-h-[80vh] bg-surface-950"
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
            {/* Background image with subtle zoom */}
            <picture className="absolute inset-0 block">
              <source media="(max-width: 767px)" srcSet={mobileSrc} />
              <img
                src={desktopSrc}
                alt={current?.title ?? ""}
                className="absolute inset-0 w-full h-full object-cover object-center scale-105 transition-all duration-1000"
                sizes="(max-width: 768px) 100vw, 1280px"
                fetchPriority="high"
              />
            </picture>

            {/* Dramatic cinematic overlays */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/50 to-surface-950/10 pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-surface-950/80 via-surface-950/20 to-transparent pointer-events-none"
              aria-hidden
            />
            <div
              className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(34,197,94,0.05),transparent)] pointer-events-none"
              aria-hidden
            />

            {/* Featured badge */}
            <div className="absolute top-5 left-5 sm:top-8 sm:left-8 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white uppercase tracking-wider">
                <Clapperboard className="w-3.5 h-3.5 text-brand-400" />
                Featured
              </span>
            </div>

            {/* Content overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-6 sm:p-10 md:p-14 lg:p-16 flex flex-col gap-4 max-w-3xl">
              {/* Meta pills */}
              {(year != null || rating != null) && (
                <div className="flex flex-wrap items-center gap-2">
                  {year != null && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 text-sm text-surface-300">
                      <Calendar className="w-3.5 h-3.5 text-surface-500" />
                      {year}
                    </span>
                  )}
                  {rating != null && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 text-sm">
                      <Star className="w-3.5 h-3.5 text-accent-gold fill-accent-gold" />
                      <span className="text-white font-semibold">{rating}</span>
                      <span className="text-surface-500">/10</span>
                    </span>
                  )}
                </div>
              )}

              {/* Title with gradient */}
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-none tracking-tight hero-title-gradient">
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

              {/* CTA */}
              {current?.id && (
                <Link
                  href={`/app/movie/${current.id}`}
                  className="mt-2 inline-flex w-fit items-center gap-2.5 rounded-full bg-brand-500 px-7 py-3 text-sm font-semibold text-surface-950 hover:bg-brand-400 transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Play className="w-4 h-4 fill-surface-950" />
                  View Film
                </Link>
              )}
            </div>

            {/* Navigation dots */}
            {items.length > 1 && (
              <div className="absolute bottom-5 right-5 sm:bottom-8 sm:right-8 z-10 flex items-center gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? "h-2 w-8 bg-brand-400"
                        : "h-2 w-2 bg-white/20 hover:bg-white/40"
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
                  className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 p-3 text-white hover:bg-black/50 transition-all md:block"
                  aria-label="Previous"
                >
                  <FaChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 p-3 text-white hover:bg-black/50 transition-all md:block"
                  aria-label="Next"
                >
                  <FaChevronRight size={16} />
                </button>
              </>
            )}
          </>
        )}
      </section>

      {/* Reels CTA strip */}
      <div className="flex items-center justify-between gap-4 bg-surface-900/60 backdrop-blur-sm px-5 py-3 sm:px-8 border-b border-white/5">
        <p className="text-sm text-surface-500">
          Short clips by mood and your watchlist.
        </p>
        <Link
          href="/app/reel"
          className="shrink-0 rounded-full bg-surface-800/60 border border-surface-700/50 px-4 py-2 text-sm font-medium text-surface-300 hover:bg-surface-700 hover:text-white transition-all"
        >
          Watch Reels
        </Link>
      </div>
    </div>
  );
}

export default HomeHeroBanner;
