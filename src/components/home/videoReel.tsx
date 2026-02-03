"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { FetchError } from "@/components/ui/FetchError";

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
          : [{ id: 0, title: "No content available", poster_path: null, backdrop_path: null }]
      );
    } catch (err) {
      setError((err as Error).message ?? "Couldn't load hero");
      setItems([
        { id: 0, title: "No content available", poster_path: null, backdrop_path: null },
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

  const onTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    setTouchStart(x);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    setTouchMove(x);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (touchStart != null && touchMove != null) {
      const delta = touchMove - touchStart;
      if (Math.abs(delta) > 50) delta > 0 ? prev() : next();
    }
    setTouchStart(null);
    setTouchMove(null);
  }, [touchStart, touchMove, prev, next]);

  if (error) {
    return (
      <div className="relative max-w-[1920px] mx-auto w-full rounded-xl overflow-hidden">
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
    <div className="relative max-w-[1920px] mx-auto w-full rounded-xl overflow-hidden shadow-2xl">
      <section
        className="relative w-full min-h-[70vw] sm:min-h-[50vw] md:min-h-[42vw] lg:min-h-[32rem] max-h-[85vh] bg-neutral-950"
        aria-label="Romance and emotion"
        onMouseDown={onTouchStart}
        onMouseMove={onTouchMove}
        onMouseUp={onTouchEnd}
        onMouseLeave={onTouchEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-900">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: `url(${FALLBACK_IMAGE})` }}
            />
            <AiOutlineLoading3Quarters className="relative size-14 text-white/80 animate-spin" />
            <p className="relative text-sm text-white/60">Loading…</p>
          </div>
        ) : (
          <>
            {/* Desktop: landscape backdrop (or poster as fallback) */}
            <picture className="absolute inset-0 block">
              <source
                media="(max-width: 767px)"
                srcSet={mobileSrc}
              />
              <img
                src={desktopSrc}
                alt={current?.title ?? ""}
                className="absolute inset-0 w-full h-full object-cover object-center"
                sizes="(max-width: 768px) 100vw, 1280px"
                fetchPriority="high"
              />
            </picture>

            {/* Gradient overlay for readability */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"
              aria-hidden
            />

            {/* Pill label */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
              <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white/95 backdrop-blur-md border border-white/20">
                Romance & emotion
              </span>
            </div>

            {/* Details overlay — bottom left */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-6 md:p-8 flex flex-col gap-2 sm:gap-3">
              <div className="flex flex-wrap items-center gap-2 text-white/90 text-sm">
                {year != null && (
                  <span className="font-medium">{year}</span>
                )}
                {rating != null && (
                  <>
                    {year != null && <span className="text-white/50">·</span>}
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400">★</span> {rating}
                    </span>
                  </>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg max-w-3xl leading-tight">
                {current?.id ? (
                  <Link
                    href={`/app/movie/${current.id}`}
                    className="hover:underline focus:outline-none focus:underline"
                  >
                    {current.title}
                  </Link>
                ) : (
                  <span>{current?.title ?? "—"}</span>
                )}
              </h2>
              <p className="text-white/80 text-sm sm:text-base max-w-xl">
                Love stories and feel-good picks — discover more below.
              </p>
              {current?.id && (
                <Link
                  href={`/app/movie/${current.id}`}
                  className="mt-2 inline-flex w-fit items-center rounded-lg bg-white/20 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
                >
                  View movie
                </Link>
              )}
            </div>

            {/* Navigation — dots */}
            {items.length > 1 && (
              <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === currentIndex
                        ? "w-8 bg-white"
                        : "w-2 bg-white/50 hover:bg-white/70"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Arrows — desktop */}
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-3 text-white backdrop-blur-sm hover:bg-black/60 md:block"
                  aria-label="Previous"
                >
                  <FaChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-3 text-white backdrop-blur-sm hover:bg-black/60 md:block"
                  aria-label="Next"
                >
                  <FaChevronRight size={20} />
                </button>
              </>
            )}
          </>
        )}
      </section>

      {/* Reels CTA strip — compact */}
      <div className="flex items-center justify-between gap-4 bg-neutral-800/95 px-4 py-3 sm:px-6 sm:py-4 border-t border-neutral-700/50">
        <p className="text-sm text-neutral-300">
          Short clips by mood and your watchlist.
        </p>
        <Link
          href="/app/reel"
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          Watch Reels
        </Link>
      </div>
    </div>
  );
}

export default HomeHeroBanner;
