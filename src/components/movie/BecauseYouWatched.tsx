"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import MediaCard from "@components/cards/MediaCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { FaChevronLeft, FaChevronRight, FaPlus, FaCheck, FaInfo } from "react-icons/fa6";

type GenreWeight = { genre: string; weight: number };

type BecauseItem = {
  id: string;
  title: string;
  mediaType: string;
  posterUrl: string | null;
  year: string;
  overview: string;
  voteAverage: number;
  matchScore: number;
  matchReason: string;
  genreBreakdown: GenreWeight[];
  sharedGenreCount: number;
};

type BecauseResponse = {
  results: BecauseItem[];
  total: number;
  currentTitle: string;
  userTopGenres: string[];
};

function MatchBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-500/70 text-white" :
    score >= 40 ? "bg-yellow-500/70 text-black" :
    "bg-surface-700/70 text-surface-300";
  return (
    <div className={`text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm font-medium ${color}`}>
      {score}% match
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-green-500" :
    score >= 40 ? "bg-yellow-500" :
    "bg-surface-600";
  return (
    <div className="w-full h-1 bg-surface-700 rounded-full overflow-hidden mt-1">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function GenreTooltip({
  children,
  breakdown,
  matchScore,
}: {
  children: React.ReactNode;
  breakdown: GenreWeight[];
  matchScore: number;
}) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShow(true), 400);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setShow(false);
  };

  if (breakdown.length === 0) return <>{children}</>;

  return (
    <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 min-w-[160px]">
          <div className="bg-surface-800 border border-surface-700 rounded-lg shadow-xl p-3">
            <p className="text-[10px] text-surface-500 uppercase tracking-wider mb-1.5">Genre Match</p>
            <div className="space-y-1">
              {breakdown.map((g) => (
                <div key={g.genre} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-surface-300">{g.genre}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${Math.max((g.weight + 1) * 50, 10)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-surface-500 w-6 text-right">
                      {g.weight > 0 ? "+" : ""}{g.weight.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-surface-700/50 flex justify-between text-[10px]">
              <span className="text-surface-500">Overall</span>
              <span className="text-white font-semibold">{matchScore}%</span>
            </div>
          </div>
          <div className="w-2 h-2 bg-surface-800 border-r border-b border-surface-700 rotate-45 mx-auto -mt-1" />
        </div>
      )}
    </div>
  );
}

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
  const [currentTitle, setCurrentTitle] = useState("");
  const [userTopGenres, setUserTopGenres] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [itemWidth, setItemWidth] = useState(200);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Fetch recommendations
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch(`/api/recommendations/because-you-watched?itemId=${itemId}&mediaType=${mediaType}`)
      .then((r) => r.json())
      .then((data: BecauseResponse) => {
        if (mounted) {
          setItems(data.results ?? []);
          setCurrentTitle(data.currentTitle ?? "");
          setUserTopGenres(data.userTopGenres ?? []);
          setError(null);
        }
      })
      .catch(() => { if (mounted) setError("Failed to load"); })
      .finally(() => { if (mounted) setLoading(false); });
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

  // Add to watchlist
  const addToWatchlist = async (item: BecauseItem) => {
    const key = `${item.mediaType}:${item.id}`;
    if (watchlistIds.has(key)) return;

    // Optimistic update
    setWatchlistIds((prev) => new Set(prev).add(key));

    try {
      await fetch("/api/watchlistButton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          name: item.title,
          mediaType: item.mediaType,
          imgUrl: item.posterUrl ?? "",
          adult: false,
          genres: item.genreBreakdown.map((g) => g.genre),
        }),
      });
    } catch {
      setWatchlistIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

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

  const title = sectionTitle ?? (currentTitle ? `Because you watched ${currentTitle}` : "Because you watched");

  return (
    <section className="max-w-6xl w-full mx-auto px-4 py-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {userTopGenres.length > 0 && (
          <span className="text-xs text-surface-500 hidden sm:block">
            Matched by {userTopGenres.slice(0, 3).join(", ")}
          </span>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className="flex flex-row gap-4 py-2 overflow-x-auto no-scrollbar pb-2"
          onScroll={handleScroll}
        >
          {items.map((item) => {
            const key = `${item.mediaType}:${item.id}`;
            const inWatchlist = watchlistIds.has(key);

            return (
              <GenreTooltip key={key} breakdown={item.genreBreakdown} matchScore={item.matchScore}>
                <div className="relative shrink-0 card-item group">
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

                  {/* Vote average */}
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-accent-gold">
                    {item.voteAverage.toFixed(1)}
                  </div>

                  {/* Match score bar */}
                  <ScoreBar score={item.matchScore} />

                  {/* Bottom info area */}
                  <div className="flex items-center gap-1 mt-1">
                    <MatchBadge score={item.matchScore} />

                    {/* Overview preview toggle */}
                    {item.overview && (
                      <button
                        onClick={() => setPreviewId(previewId === item.id ? null : item.id)}
                        className="text-surface-500 hover:text-surface-200 transition-colors"
                        title="Show overview"
                      >
                        <FaInfo size={12} />
                      </button>
                    )}
                  </div>

                  {/* Overview preview */}
                  {previewId === item.id && item.overview && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 z-20">
                      <div className="bg-surface-800 border border-surface-700 rounded-lg p-2.5 shadow-xl mx-1">
                        <p className="text-[10px] text-surface-400 leading-relaxed line-clamp-4">
                          {item.overview}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Add to watchlist button — appears on hover */}
                  <button
                    onClick={() => addToWatchlist(item)}
                    className={`absolute top-2 left-2 p-1.5 rounded-full transition-all duration-200 ${
                      inWatchlist
                        ? "bg-green-500/80 text-white opacity-100"
                        : "bg-black/60 text-surface-300 opacity-0 group-hover:opacity-100 hover:bg-brand-500/80 hover:text-white"
                    }`}
                    title={inWatchlist ? "In watchlist" : "Add to watchlist"}
                  >
                    {inWatchlist ? <FaCheck size={10} /> : <FaPlus size={10} />}
                  </button>
                </div>
              </GenreTooltip>
            );
          })}
        </div>

        {/* Gradient fades */}
        <div className={`hidden md:block absolute top-0 left-0 h-full w-12 sm:w-20 bg-gradient-to-r from-surface-950 to-transparent pointer-events-none transition-opacity ${canScrollLeft ? "opacity-100" : "opacity-0"}`} />
        <div className={`hidden md:block absolute top-0 right-0 h-full w-12 sm:w-20 bg-gradient-to-l from-surface-950 to-transparent pointer-events-none transition-opacity ${canScrollRight ? "opacity-100" : "opacity-0"}`} />

        {/* Scroll buttons */}
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
