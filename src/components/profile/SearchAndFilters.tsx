"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { FaSearch } from "react-icons/fa";
import { PiFilmSlateBold, PiHeartBold, PiListChecksBold } from "react-icons/pi";
import ProfileAvatar from "@components/profile/ProfileAvatar";

type SortKey = "recent" | "watched" | "favorites" | "watchlist";

interface UserCoutStats {
  watched_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
}

interface ProfileUser {
  username: string;
  about?: string | null;
  avatar_url?: string | null;
  user_cout_stats?: UserCoutStats | null;
}

export default function SearchAndFilters({ users }: { users: ProfileUser[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const filteredAndSorted = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = (users ?? []).filter(
      (u): u is ProfileUser & { username: string } => u != null && !!u.username
    );
    if (q) {
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (typeof u.about === "string" && u.about.toLowerCase().includes(q))
      );
    }
    if (sort === "watched") {
      list = [...list].sort(
        (a, b) =>
          (b.user_cout_stats?.watched_count ?? 0) - (a.user_cout_stats?.watched_count ?? 0)
      );
    } else if (sort === "favorites") {
      list = [...list].sort(
        (a, b) =>
          (b.user_cout_stats?.favorites_count ?? 0) - (a.user_cout_stats?.favorites_count ?? 0)
      );
    } else if (sort === "watchlist") {
      list = [...list].sort(
        (a, b) =>
          (b.user_cout_stats?.watchlist_count ?? 0) - (a.user_cout_stats?.watchlist_count ?? 0)
      );
    }
    return list;
  }, [users, searchQuery, sort]);

  return (
    <div className="space-y-6">
      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <FaSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search by username or bio…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-colors"
            aria-label="Search profiles"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "recent" as const, label: "Recent" },
              { key: "watched" as const, label: "Most watched" },
              { key: "favorites" as const, label: "Most favorites" },
              { key: "watchlist" as const, label: "Most watchlist" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                sort === key
                  ? "bg-amber-500 text-neutral-900"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-neutral-500">
        {filteredAndSorted.length === 0
          ? "No profiles found"
          : `${filteredAndSorted.length} profile${filteredAndSorted.length !== 1 ? "s" : ""}`}
      </p>

      {/* Empty state */}
      {filteredAndSorted.length === 0 && (
        <div className="rounded-2xl border border-neutral-700 bg-neutral-800/40 p-12 text-center">
          <p className="text-neutral-400">
            {searchQuery.trim()
              ? "Try a different search or clear the filter."
              : "No public profiles yet."}
          </p>
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-4 px-4 py-2 rounded-xl bg-neutral-700 text-neutral-200 text-sm font-medium hover:bg-neutral-600 transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* User grid */}
      {filteredAndSorted.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredAndSorted.map((item) => (
            <Link
              key={item.username}
              href={`/app/profile/${item.username}`}
              className="group block rounded-2xl border border-neutral-700/60 bg-neutral-800/50 hover:bg-neutral-800 hover:border-neutral-600 transition-all duration-200 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <ProfileAvatar
                    src={item.avatar_url || "/avatar.svg"}
                    alt={`@${item.username}`}
                    className="w-14 h-14 rounded-xl object-cover border border-neutral-700 shrink-0 bg-neutral-700 group-hover:border-neutral-600 transition-colors"
                    width={56}
                    height={56}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                      @{item.username}
                    </h2>
                    {item.about && (
                      <p className="text-sm text-neutral-400 line-clamp-2 mt-0.5">{item.about}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-700/60 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-neutral-400" title="Watched">
                    <PiFilmSlateBold className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden />
                    <span className="font-medium text-neutral-300 tabular-nums">
                      {item.user_cout_stats?.watched_count ?? 0}
                    </span>
                    <span className="sr-only">Watched</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-neutral-400" title="Favorites">
                    <PiHeartBold className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden />
                    <span className="font-medium text-neutral-300 tabular-nums">
                      {item.user_cout_stats?.favorites_count ?? 0}
                    </span>
                    <span className="sr-only">Favorites</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-neutral-400" title="Watchlist">
                    <PiListChecksBold className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden />
                    <span className="font-medium text-neutral-300 tabular-nums">
                      {item.user_cout_stats?.watchlist_count ?? 0}
                    </span>
                    <span className="sr-only">Watchlist</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
