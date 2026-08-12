"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { PiFilmSlateBold, PiHeartBold, PiListChecksBold } from "react-icons/pi";
import ProfileAvatar from "@components/profile/ProfileAvatar";
import FollowButton, { type FollowStatus } from "@components/profile/FollowButton";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type SortKey = "recent" | "watched" | "favorites" | "watchlist";

interface UserCoutStats {
  watched_count?: number;
  favorites_count?: number;
  watchlist_count?: number;
}

export interface ProfileUser {
  id: string;
  username: string;
  about?: string | null;
  avatar_url?: string | null;
  isFollowing?: boolean;
  followsYou?: boolean;
  user_cout_stats?: UserCoutStats | null;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "watched", label: "Most watched" },
  { key: "favorites", label: "Most favorites" },
  { key: "watchlist", label: "Most watchlist" },
];

export default function SearchAndFilters({
  initialUsers = [],
}: {
  initialUsers?: ProfileUser[];
}) {
  const { user: authUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [users, setUsers] = useState<ProfileUser[]>(initialUsers);
  const [loading, setLoading] = useState(false);

  // Debounced server-side search/browse. Replaces the old approach of loading
  // every public profile up front and filtering in the browser.
  useEffect(() => {
    const q = searchQuery.trim();
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ limit: "60", sort });
          if (q) params.set("q", q);
          const res = await fetch(`/api/users/search?${params}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error(`search failed: ${res.status}`);
          const data = await res.json();
          setUsers(data.users ?? []);
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            console.error("People search failed:", err);
            setUsers([]);
          }
        } finally {
          setLoading(false);
        }
      },
      q ? 250 : 0,
    );

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, sort]);

  const onFollowChange = (id: string, status: FollowStatus) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, isFollowing: status === "following" } : u)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <FaSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500 pointer-events-none"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search by username…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-800/80 border border-surface-700 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-amber-500/50 transition-colors"
            aria-label="Search profiles"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-900 ${
                sort === key
                  ? "bg-amber-500 text-surface-900"
                  : "bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-white border border-surface-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-surface-500">
        {loading
          ? "Searching…"
          : users.length === 0
            ? "No profiles found"
            : `${users.length} profile${users.length !== 1 ? "s" : ""}`}
      </p>

      {loading && users.length === 0 && (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Empty state */}
      {!loading && users.length === 0 && (
        <div className="rounded-2xl border border-surface-700 bg-surface-800/40 p-12 text-center">
          <p className="text-surface-400">
            {searchQuery.trim()
              ? "Try a different search or clear the filter."
              : "No public profiles yet."}
          </p>
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-4 px-4 py-2 rounded-xl bg-surface-700 text-surface-200 text-sm font-medium hover:bg-surface-600 transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-900"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* User grid */}
      {users.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {users.map((item) => (
            <div
              key={item.id}
              className="group rounded-2xl border border-surface-700/60 bg-surface-800/50 hover:bg-surface-800 hover:border-surface-600 transition-all duration-200 overflow-hidden"
            >
              <div className="p-5">
                <Link
                  href={`/app/profile/${item.username}`}
                  className="flex items-start gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 rounded-xl"
                >
                  <ProfileAvatar
                    src={item.avatar_url || "/avatar.svg"}
                    alt={`@${item.username}`}
                    className="w-14 h-14 rounded-xl object-cover border border-surface-700 shrink-0 bg-surface-700 group-hover:border-surface-600 transition-colors"
                    width={56}
                    height={56}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                      @{item.username}
                    </h2>
                    {item.followsYou && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-300 text-[10px] font-semibold">
                        Follows you
                      </span>
                    )}
                    {item.about && (
                      <p className="text-sm text-surface-400 line-clamp-2 mt-0.5">{item.about}</p>
                    )}
                  </div>
                </Link>
                <div className="mt-4 pt-4 border-t border-surface-700/60 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-surface-400" title="Watched">
                    <PiFilmSlateBold className="w-4 h-4 text-surface-500 shrink-0" aria-hidden />
                    <span className="font-medium text-surface-300 tabular-nums">
                      {item.user_cout_stats?.watched_count ?? 0}
                    </span>
                    <span className="sr-only">Watched</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-surface-400" title="Favorites">
                    <PiHeartBold className="w-4 h-4 text-surface-500 shrink-0" aria-hidden />
                    <span className="font-medium text-surface-300 tabular-nums">
                      {item.user_cout_stats?.favorites_count ?? 0}
                    </span>
                    <span className="sr-only">Favorites</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-surface-400" title="Watchlist">
                    <PiListChecksBold className="w-4 h-4 text-surface-500 shrink-0" aria-hidden />
                    <span className="font-medium text-surface-300 tabular-nums">
                      {item.user_cout_stats?.watchlist_count ?? 0}
                    </span>
                    <span className="sr-only">Watchlist</span>
                  </span>
                </div>
                <FollowButton
                  targetUserId={item.id}
                  currentUserId={authUser?.id ?? null}
                  initialStatus={item.isFollowing ? "following" : "follow"}
                  size="sm"
                  className="mt-4 w-full"
                  onStatusChange={(s) => onFollowChange(item.id, s)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
