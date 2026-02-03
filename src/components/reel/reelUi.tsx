// components/ReelViewer.tsx — Cinematic reel experience
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaChevronDown, FaChevronUp } from "react-icons/fa6";
import Link from "next/link";
import ThreePrefrenceBtn from "../buttons/threePrefrencebtn";
import { FaSearch } from "react-icons/fa";
import SendMessageModal from "@components/message/sendCard";
import { LuSend } from "react-icons/lu";
import { HiOutlineFilm } from "react-icons/hi2";

interface Movie {
  id: number;
  title: string;
  trailer?: string;
  poster_path?: string;
  genres: string[];
  imdb_id?: string;
  adult: boolean;
}

const WATCHLIST_KEY = "__watchlist__";

const MOODS = [
  "action",
  "comedy",
  "drama",
  "romance",
  "horror",
  "thriller",
  "sci-fi",
  "adventure",
  "fantasy",
  "mystery",
  "crime",
  "animation",
  "family",
  "suspense",
  "feel-good",
  "noir",
  "superhero",
  "documentary",
  "history",
];

export default function ReelViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const genreFromUrl = searchParams.get("genre");

  const [selectedKeyword, setSelectedKeyword] = useState<string>(() => {
    if (genreFromUrl) return genreFromUrl;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("reel_last_keyword");
      if (saved && (saved === WATCHLIST_KEY || MOODS.includes(saved))) return saved;
    }
    return "action";
  });
  const [searchInput, setSearchInput] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [nextLoading, setNextLoading] = useState(false);
  const [imdbRating, setImdbRating] = useState<string>("—");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<Movie | null>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const moodScrollRef = useRef<HTMLDivElement>(null);
  const nextReelRef = useRef<() => void>(() => {});

  const fetchMovies = useCallback(async (page: number) => {
    setLoading(page === 1);
    setError(null);
    try {
      if (selectedKeyword === WATCHLIST_KEY) {
        const res = await fetch("/api/movieReel/watchlist", { credentials: "include" });
        const data = await res.json();
        if (!res.ok) {
          const msg = res.status === 401
            ? "Log in to see reels from your watchlist"
            : (data?.error || "Failed to fetch watchlist reels");
          throw new Error(msg);
        }
        setMovies(data.movies ?? []);
        setTotalPages(data.totalPages ?? 1);
        setCurrentIndex(0);
      } else {
        const res = await fetch("/api/movieReel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: selectedKeyword, page }),
        });
        if (!res.ok) throw new Error("Failed to fetch movies");
        const { movies: newMovies, totalPages: pages } = await res.json();
        setMovies(newMovies ?? []);
        setTotalPages(pages ?? 1);
        setCurrentIndex(0);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setNextLoading(false);
    }
  }, [selectedKeyword]);

  useEffect(() => {
    const page = selectedKeyword === WATCHLIST_KEY ? 1 : currentPage;
    fetchMovies(page);
    if (selectedKeyword !== WATCHLIST_KEY) {
      router.push(`/app/reel?keyword=${encodeURIComponent(selectedKeyword)}&page=${currentPage}`, { scroll: false });
    }
  }, [selectedKeyword, currentPage, router, fetchMovies]);

  useEffect(() => {
    if (typeof window !== "undefined" && selectedKeyword) {
      localStorage.setItem("reel_last_keyword", selectedKeyword);
    }
  }, [selectedKeyword]);

  useEffect(() => {
    const movie = movies[currentIndex];
    if (!movie?.imdb_id) {
      setImdbRating("—");
      return;
    }
    setImdbRating("…");
    let cancelled = false;
    fetch(`/api/omdb?i=${movie.imdb_id}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((res) => { if (!cancelled && res?.imdbRating) setImdbRating(res.imdbRating); else if (!cancelled) setImdbRating("—"); })
      .catch(() => { if (!cancelled) setImdbRating("—"); });
    return () => { cancelled = true; };
  }, [movies, currentIndex]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.querySelector("script")?.parentNode?.insertBefore(tag, document.querySelector("script"));
    }
    const init = () => {
      if (!playerRef.current || !movies[currentIndex]?.trailer || !window.YT?.Player) return;
      const videoId = movies[currentIndex].trailer!.split("embed/")[1]?.split("?")[0] || "";
      if (!videoId) return;
      const newPlayer = new window.YT.Player(playerRef.current, {
        height: "100%",
        width: "100%",
        videoId,
        playerVars: { autoplay: 1, mute: 1, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: (e: YT.PlayerEvent) => setPlayer(e.target),
          onStateChange: (e: YT.OnStateChangeEvent) => {
            if (e.data === window.YT.PlayerState.PLAYING) e.target.unMute();
            if (e.data === window.YT.PlayerState.ENDED) nextReelRef.current();
          },
        },
      });
    };
    if (window.YT?.Player) init();
    else (window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = init;
    return () => {
      if (player) {
        try { player.destroy(); } catch {}
        setPlayer(null);
      }
    };
  }, [movies, currentIndex]);

  const nextReel = useCallback(() => {
    if (currentIndex + 1 < movies.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      if (player && movies[nextIndex]?.trailer) {
        const id = movies[nextIndex].trailer!.split("embed/")[1]?.split("?")[0];
        if (id) player.loadVideoById(id);
      }
    } else if (currentPage < totalPages) {
      setNextLoading(true);
      setCurrentPage((p) => p + 1);
    }
  }, [currentIndex, movies, currentPage, totalPages, player]);

  nextReelRef.current = nextReel;

  const prevReel = useCallback(() => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      if (player && movies[prevIndex]?.trailer) {
        const id = movies[prevIndex].trailer!.split("embed/")[1]?.split("?")[0];
        if (id) player.loadVideoById(id);
      }
    } else if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  }, [currentIndex, movies, currentPage, player]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") { e.preventDefault(); nextReel(); }
      if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); prevReel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextReel, prevReel]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (q) {
      setSelectedKeyword(q);
      setSearchInput("");
      setCurrentPage(1);
    }
  };

  const handleMoodClick = (keyword: string) => {
    setSelectedKeyword(keyword);
    setCurrentPage(1);
  };

  const currentMovie = movies[currentIndex];
  const hasPrev = currentIndex > 0 || currentPage > 1;
  const hasNext = currentIndex < movies.length - 1 || currentPage < totalPages;
  const moodLabel = selectedKeyword === WATCHLIST_KEY ? "Your watchlist" : selectedKeyword;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(120,80,40,0.06),transparent)] pointer-events-none" />
      <SendMessageModal media_type="movie" data={cardData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Header: title + search + mood pills */}
      <header className="relative z-10 shrink-0 px-4 sm:px-6 py-4 border-b border-neutral-800/80">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
              <HiOutlineFilm className="w-6 h-6 text-amber-400" />
              Reels
            </span>
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search mood..."
                className={`w-40 sm:w-52 py-2 pl-3 pr-9 rounded-xl bg-neutral-800/80 text-white placeholder-neutral-500 text-sm border transition-all ${
                  searchFocused ? "border-amber-500/50 ring-2 ring-amber-500/20" : "border-transparent"
                }`}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-700/50"
                aria-label="Search"
              >
                <FaSearch className="w-4 h-4" />
              </button>
            </form>
          </div>
          <div
            ref={moodScrollRef}
            className="flex-1 overflow-x-auto scrollbar-none flex gap-2 pb-1 -mx-1"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
          >
            <button
              type="button"
              onClick={() => handleMoodClick(WATCHLIST_KEY)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedKeyword === WATCHLIST_KEY
                  ? "bg-amber-500 text-neutral-900"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              Your watchlist
            </button>
            {MOODS.map((mood) => (
              <button
                key={mood}
                type="button"
                onClick={() => handleMoodClick(mood)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                  selectedKeyword === mood
                    ? "bg-amber-500 text-neutral-900"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-center sm:text-left text-xs text-neutral-500 max-w-6xl mx-auto">
          Showing: <span className="text-neutral-300 capitalize">{moodLabel}</span>
          {selectedKeyword !== WATCHLIST_KEY && (
            <span className="ml-2">· Use ↑↓ or click arrows to switch reels</span>
          )}
        </p>
      </header>

      {/* Main: video + overlay */}
      <main className="relative flex-1 flex items-center justify-center p-4 sm:p-6 min-h-0">
        {loading ? (
          <div className="w-full max-w-4xl aspect-video rounded-2xl bg-neutral-800/80 animate-pulse flex items-center justify-center">
            <span className="text-neutral-500 text-sm">Loading reels…</span>
          </div>
        ) : error ? (
          <div className="text-center max-w-md mx-auto p-6 rounded-2xl bg-neutral-800/50 border border-neutral-700">
            <p className="text-red-400 text-sm font-medium mb-2">{error}</p>
            <p className="text-neutral-500 text-xs mb-4">
              {error.includes("Log in")
                ? "Sign in to see reels from movies in your watchlist."
                : "Try another mood or your watchlist."}
            </p>
            {error.includes("Log in") ? (
              <Link
                href="/login"
                className="inline-block px-4 py-2 rounded-xl bg-amber-500 text-neutral-900 text-sm font-medium hover:bg-amber-400"
              >
                Log in
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => fetchMovies(1)}
                className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-900 text-sm font-medium hover:bg-amber-400"
              >
                Retry
              </button>
            )}
          </div>
        ) : movies.length === 0 ? (
          <div className="text-center max-w-md mx-auto p-8 rounded-2xl bg-neutral-800/50 border border-neutral-700">
            <HiOutlineFilm className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <p className="text-neutral-300 font-medium mb-1">No reels here</p>
            <p className="text-neutral-500 text-sm mb-4">
              {selectedKeyword === WATCHLIST_KEY
                ? "Add movies with trailers to your watchlist to see them here."
                : `No movies with trailers found for "${selectedKeyword}". Try another mood.`}
            </p>
            {selectedKeyword !== WATCHLIST_KEY && (
              <button
                type="button"
                onClick={() => handleMoodClick("action")}
                className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-900 text-sm font-medium hover:bg-amber-400"
              >
                Browse Action
              </button>
            )}
          </div>
        ) : (
          <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            {/* Video container with overlays */}
            <div className="relative w-full aspect-video max-h-[70vh] rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-neutral-700/50">
              <div ref={playerRef} className="absolute inset-0 w-full h-full" />
              {/* Bottom gradient + info */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 pointer-events-auto">
                <Link
                  href={`/app/movie/${currentMovie.id}`}
                  className="block text-lg sm:text-xl font-semibold text-white hover:text-amber-300 transition-colors line-clamp-2"
                >
                  {currentMovie.title}
                </Link>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-400">
                  {currentMovie.imdb_id && (
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400 font-medium">IMDb</span> {imdbRating}
                    </span>
                  )}
                  <span>
                    {currentIndex + 1} of {movies.length}
                    {totalPages > 1 && ` · Page ${currentPage}/${totalPages}`}
                  </span>
                </div>
                <Link
                  href={`/app/movie/${currentMovie.id}`}
                  className="inline-block mt-2 text-sm font-medium text-amber-400 hover:text-amber-300"
                >
                  View movie →
                </Link>
              </div>
              {/* Position dots (optional, minimal) */}
              {movies.length <= 10 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                  {movies.slice(0, 10).map((_, i) => (
                    <span
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === currentIndex ? "bg-amber-400" : "bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right: prev/next + actions — one cohesive strip */}
            <div className="flex sm:flex-col items-center gap-4 shrink-0">
              <div className="flex sm:flex-col gap-2">
                <button
                  type="button"
                  onClick={prevReel}
                  disabled={!hasPrev}
                  className="p-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous reel"
                >
                  <FaChevronUp className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <button
                  type="button"
                  onClick={nextReel}
                  disabled={!hasNext || nextLoading}
                  className="p-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[44px]"
                  aria-label="Next reel"
                >
                  {nextLoading ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FaChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </button>
              </div>
              {/* Preference + Share as one card, same pill style */}
              <div className="w-full sm:w-48 rounded-2xl border border-neutral-700/60 bg-neutral-800/80 p-3 flex flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <ThreePrefrenceBtn
                    cardId={currentMovie.id}
                    cardType="movie"
                    cardName={currentMovie.title}
                    cardAdult={currentMovie.adult}
                    cardImg={currentMovie.poster_path || ""}
                    genres={currentMovie.genres}
                    variant="detail"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setCardData(currentMovie); setIsModalOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-neutral-200 bg-neutral-700/80 hover:bg-neutral-600 border border-neutral-600 hover:border-neutral-500 transition-colors"
                  aria-label="Share"
                >
                  <LuSend className="w-4 h-4 shrink-0" />
                  Share
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
