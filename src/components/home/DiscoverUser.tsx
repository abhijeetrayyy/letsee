"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaHeart, FaBookmark, FaEye } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi2";
import { useApiFetch } from "@/hooks/useApiFetch";
import { FetchError } from "@/components/ui/FetchError";
import ProfileAvatar from "@components/profile/ProfileAvatar";
import FollowButton from "@components/profile/FollowButton";
import { useAuth } from "@/app/contextAPI/AuthProvider";

interface User {
  id: string;
  username: string;
  about?: string;
  avatar_url?: string | null;
  watched_count: number;
  favorites_count: number;
  watchlist_count: number;
  followsYou?: boolean;
  matchPercent?: number | null;
  sharedGenres?: string[];
  recentPosters?: string[];
}

type DiscoverUsersProps = { hideTitleLink?: boolean };

function formatUsername(username: string, maxLen = 14) {
  if (username.length <= maxLen) return username;
  return `${username.slice(0, maxLen - 1)}…`;
}

/**
 * Poster banner across the top of a user card. Falls back to a plain gradient
 * for people with nothing watched yet, so the card never looks broken.
 */
function PosterStrip({ posters }: { posters: string[] }) {
  if (posters.length === 0) {
    return <div className="h-24 bg-gradient-to-br from-surface-800 to-surface-900" />;
  }
  return (
    <div className="relative h-24 flex gap-px bg-surface-900 overflow-hidden">
      {posters.slice(0, 4).map((src, i) => (
        // Plain <img>: these are TMDB URLs already stored per-item, and
        // routing them through next/image only adds a failure mode.
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          className="flex-1 min-w-0 h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
        />
      ))}
      {/* Only darken the bottom, where the avatar and name sit — a full-height
          scrim turned the posters into a black bar. */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-surface-900 to-transparent" />
    </div>
  );
}

function DiscoverUsers({ hideTitleLink }: DiscoverUsersProps = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { user: authUser } = useAuth();

  const {
    data,
    error: fetchError,
    loading,
    refetch,
  } = useApiFetch<{ users?: User[] }>("/api/HomeDiscover", {
    credentials: "include",
    enabled: true,
  });

  const users = data?.users ?? [];

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector(
      ".discover-user-card"
    ) as HTMLElement | null;
    const step = (card?.offsetWidth ?? 280) + 16;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    const t = setTimeout(handleScroll, 150);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(t);
    };
  }, [users.length, loading]);

  if (fetchError) {
    return (
      <div className="w-full mx-auto">
        <FetchError
          message={
            fetchError === "Request failed (401)"
              ? "Log in to discover users."
              : fetchError
          }
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      {!hideTitleLink && (
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
          <Link
            href="/app/profile"
            className="text-lg font-semibold text-surface-200 hover:text-brand-400 transition-colors"
          >
            Discover people
          </Link>
        </div>
      )}
      <div className="relative group -mx-1 px-1">
        <div
          ref={scrollRef}
          className="flex gap-4 py-2 overflow-x-auto overflow-y-hidden scroll-smooth no-scrollbar"
          style={{ scrollPaddingInline: "8px" }}
        >
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div
                key={i}
                className="discover-user-card shrink-0 w-[260px] sm:w-[280px] rounded-2xl bg-surface-800/50 border border-surface-700/40 overflow-hidden"
              >
                <div className="h-24 bg-surface-700/30 animate-pulse" />
                <div className="p-4 pt-0">
                  <div className="-mt-7 w-14 h-14 rounded-full bg-surface-700/50 border-2 border-surface-900 animate-pulse" />
                  <div className="mt-2.5 h-4 w-24 rounded bg-surface-700/50 animate-pulse" />
                  <div className="mt-2 h-8 w-full rounded bg-surface-700/30 animate-pulse" />
                  <div className="mt-2.5 flex gap-1">
                    <div className="h-5 w-14 rounded-md bg-surface-700/40 animate-pulse" />
                    <div className="h-5 w-12 rounded-md bg-surface-700/40 animate-pulse" />
                  </div>
                  <div className="mt-3 h-8 w-full rounded-lg bg-surface-700/50 animate-pulse" />
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <div className="shrink-0 w-full min-h-[200px] rounded-2xl bg-surface-800/30 border border-surface-700/30 border-dashed flex items-center justify-center">
              <p className="text-surface-500 text-sm text-center px-4">
                No other users to show yet. Be the first to add a username and
                start sharing.
              </p>
            </div>
          ) : (
            <>
              {users.map((item) => (
                <div
                  key={item.id}
                  className="discover-user-card group shrink-0 w-[260px] sm:w-[280px] rounded-2xl bg-surface-900/60 border border-surface-700/40 hover:border-surface-600/60 hover:bg-surface-800/80 transition-all duration-300 overflow-hidden flex flex-col"
                >
                  {/* What they watch, as the header. Posters say more about a
                      stranger in one glance than any counter can. */}
                  <PosterStrip posters={item.recentPosters ?? []} />

                  <div className="p-4 pt-0 flex flex-col flex-1">
                    {/* relative z-10: the strip's absolute scrim would
                        otherwise paint over the overlapping avatar. */}
                    <div className="relative z-10 flex items-start gap-3 -mt-7">
                      <Link
                        href={`/app/profile/${item.username}`}
                        className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded-full"
                      >
                        <ProfileAvatar
                          src={item.avatar_url || "/avatar.svg"}
                          alt={`${item.username} avatar`}
                          className="w-14 h-14 rounded-full object-cover border-2 border-surface-900 group-hover:border-brand-500/40 transition-colors bg-surface-800"
                          width={56}
                          height={56}
                        />
                      </Link>
                      {typeof item.matchPercent === "number" && item.matchPercent >= 20 && (
                        <span className="mt-8 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 text-[11px] font-semibold border border-brand-500/25">
                          {item.matchPercent}% match
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/app/profile/${item.username}`}
                      className="mt-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 rounded"
                    >
                      <h3 className="text-[15px] font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
                        @{formatUsername(item.username, 18)}
                      </h3>
                    </Link>

                    {item.followsYou && (
                      <span className="mt-1 self-start px-1.5 py-0.5 rounded bg-surface-800 text-surface-400 text-[10px] font-medium">
                        Follows you
                      </span>
                    )}

                    <p className="mt-1.5 text-xs text-surface-500 line-clamp-2 min-h-8">
                      {item.about || "Movie & TV enthusiast"}
                    </p>

                    {/* Named overlap beats a bare number — it's something you
                        could open a conversation with. */}
                    {(item.sharedGenres?.length ?? 0) > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {item.sharedGenres!.map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 rounded-md bg-surface-800/80 text-surface-400 text-[11px] border border-surface-700/30"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-surface-500">
                        <span className="inline-flex items-center gap-1">
                          <FaEye className="size-3" aria-hidden />
                          {item.watched_count}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FaHeart className="size-3" aria-hidden />
                          {item.favorites_count}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FaBookmark className="size-3" aria-hidden />
                          {item.watchlist_count}
                        </span>
                      </div>
                    )}

                    {/* HomeDiscover already excludes people you follow, so these
                        are always "follow" — no per-card status query needed. */}
                    <FollowButton
                      targetUserId={item.id}
                      currentUserId={authUser?.id ?? null}
                      initialStatus="follow"
                      size="sm"
                      className="mt-auto pt-3 w-full"
                    />
                  </div>
                </div>
              ))}
              <Link
                href="/app/profile"
                className="discover-user-card shrink-0 w-[260px] sm:w-[280px] rounded-2xl bg-surface-900/30 border border-surface-700/30 border-dashed hover:border-brand-500/30 hover:bg-surface-800/50 transition-all duration-300 flex items-center justify-center min-h-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-surface-500 hover:text-brand-400 transition-colors">
                  View all
                  <HiArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Fade edges */}
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-surface-950 to-transparent transition-opacity duration-200 hidden sm:block ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-surface-950 to-transparent transition-opacity duration-200 hidden sm:block ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />

        {/* Scroll buttons */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 size-9 items-center justify-center rounded-full bg-surface-800/90 border border-surface-700/50 text-surface-300 shadow-lg hover:bg-surface-700 hover:text-white transition-all opacity-0 group-hover:opacity-100"
            aria-label="Scroll left"
          >
            <FaChevronLeft className="size-3.5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 size-9 items-center justify-center rounded-full bg-surface-800/90 border border-surface-700/50 text-surface-300 shadow-lg hover:bg-surface-700 hover:text-white transition-all opacity-0 group-hover:opacity-100"
            aria-label="Scroll right"
          >
            <FaChevronRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default DiscoverUsers;
