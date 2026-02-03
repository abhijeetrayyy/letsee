"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaHeart, FaBookmark, FaEye } from "react-icons/fa";
import { HiArrowRight } from "react-icons/hi2";
import { useApiFetch } from "@/hooks/useApiFetch";
import { FetchError } from "@/components/ui/FetchError";
import ProfileAvatar from "@components/profile/ProfileAvatar";

interface User {
  username: string;
  about?: string;
  avatar_url?: string | null;
  watched_count: number;
  favorites_count: number;
  watchlist_count: number;
}

type DiscoverUsersProps = { hideTitleLink?: boolean };

function formatUsername(username: string, maxLen = 14) {
  if (username.length <= maxLen) return username;
  return `${username.slice(0, maxLen - 1)}…`;
}

function DiscoverUsers({ hideTitleLink }: DiscoverUsersProps = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
    const card = el.querySelector(".discover-user-card") as HTMLElement | null;
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
      <div className="w-full mx-auto mb-5 md:px-4">
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
        <Link
          href="/app/profile"
          className="text-lg font-semibold mb-3 inline-block underline text-neutral-100 hover:text-indigo-300 transition-colors"
        >
          Discover people
        </Link>
      )}
      <div className="relative -mx-1 px-1">
        <div
          ref={scrollRef}
          className="flex gap-4 py-2 overflow-x-auto overflow-y-hidden scroll-smooth no-scrollbar"
          style={{ scrollPaddingInline: "8px" }}
        >
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div
                key={i}
                className="discover-user-card shrink-0 w-[260px] sm:w-[280px] rounded-2xl bg-neutral-800/80 border border-neutral-700/50 overflow-hidden"
              >
                <div className="p-5 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-neutral-700 animate-pulse" />
                  <div className="mt-3 h-5 w-24 rounded bg-neutral-700 animate-pulse" />
                  <div className="mt-2 h-4 w-full rounded bg-neutral-700/80 animate-pulse" />
                  <div className="mt-4 flex gap-3 justify-center">
                    <div className="h-8 w-14 rounded-lg bg-neutral-700 animate-pulse" />
                    <div className="h-8 w-14 rounded-lg bg-neutral-700 animate-pulse" />
                    <div className="h-8 w-14 rounded-lg bg-neutral-700 animate-pulse" />
                  </div>
                </div>
              </div>
            ))
          ) : users.length === 0 ? (
            <div className="shrink-0 w-full min-h-[200px] rounded-2xl bg-neutral-800/50 border border-neutral-700/50 border-dashed flex items-center justify-center">
              <p className="text-neutral-500 text-sm text-center px-4">
                No other users to show yet. Be the first to add a username and start sharing.
              </p>
            </div>
          ) : (
            <>
              {users.map((item) => (
                <Link
                  key={item.username}
                  href={`/app/profile/${item.username}`}
                  className="discover-user-card group shrink-0 w-[260px] sm:w-[280px] rounded-2xl bg-neutral-800/80 border border-neutral-700/50 hover:border-neutral-600 hover:bg-neutral-800 transition-all duration-200 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                >
                  <div className="p-5 flex flex-col items-center text-center">
                    <ProfileAvatar
                      src={item.avatar_url || "/avatar.svg"}
                      alt={`${item.username} avatar`}
                      className="w-20 h-20 rounded-full object-cover border-2 border-neutral-600 group-hover:border-neutral-500 transition-colors ring-2 ring-neutral-800"
                      width={80}
                      height={80}
                    />
                    <h3 className="mt-3 text-base font-semibold text-white group-hover:text-indigo-200 transition-colors truncate w-full">
                      @{formatUsername(item.username)}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-400 line-clamp-2 min-h-8">
                      {item.about || "Movie & TV enthusiast"}
                    </p>
                    <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-700/80 text-neutral-300 text-xs">
                        <FaEye className="text-neutral-500 size-3" aria-hidden />
                        {item.watched_count}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-700/80 text-neutral-300 text-xs">
                        <FaHeart className="text-neutral-500 size-3" aria-hidden />
                        {item.favorites_count}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-700/80 text-neutral-300 text-xs">
                        <FaBookmark className="text-neutral-500 size-3" aria-hidden />
                        {item.watchlist_count}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
              <Link
                href="/app/profile"
                className="discover-user-card shrink-0 w-[260px] sm:w-[280px] rounded-2xl bg-neutral-800/50 border border-neutral-700/50 border-dashed hover:border-neutral-600 hover:bg-neutral-800/80 transition-all duration-200 flex items-center justify-center min-h-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-indigo-300 transition-colors">
                  View all
                  <HiArrowRight className="size-4" aria-hidden />
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Fade edges */}
        <div
          className={`pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-neutral-900 to-transparent transition-opacity duration-200 hidden sm:block ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-neutral-900 to-transparent transition-opacity duration-200 hidden sm:block ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />

        {/* Scroll buttons */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 size-9 items-center justify-center rounded-full bg-neutral-800 border border-neutral-600 text-neutral-200 shadow-lg hover:bg-neutral-700 hover:text-white transition-colors"
            aria-label="Scroll left"
          >
            <FaChevronLeft className="size-4" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 size-9 items-center justify-center rounded-full bg-neutral-800 border border-neutral-600 text-neutral-200 shadow-lg hover:bg-neutral-700 hover:text-white transition-colors"
            aria-label="Scroll right"
          >
            <FaChevronRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default DiscoverUsers;
