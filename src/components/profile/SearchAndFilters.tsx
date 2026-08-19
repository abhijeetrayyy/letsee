"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FaSearch } from "react-icons/fa";
import Avatar from "@components/ui/Avatar";
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

      {/* User grid.

          Three across at most, not four. At four the card is 258px and the
          tally's labels overflow their columns — measured, not guessed. A
          directory of people is browsed rather than scanned in bulk, and the
          extra hundred pixels is what lets a handle, a bio and three figures
          sit together without any of them apologising. */}
      {users.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {users.map((item) => (
            /**
             * A directory entry in a film journal, not a social-network tile.
             *
             * What was here read as a template: a grey silhouette, three
             * cryptic icon-and-digit pairs, and a full-width saturated slab for
             * a secondary action. Three changes, each with a reason:
             *
             * 1. The shared Avatar, which falls back to deterministic coloured
             *    initials. ProfileAvatar falls back to /avatar.svg — so a
             *    directory of people who have not set a picture rendered as six
             *    identical grey silhouettes, which is the single thing that
             *    made the page look unfinished.
             *
             * 2. The counts are set as a tally rather than decorated with
             *    icons: tabular figures with a quiet label under each. This is
             *    the one place the card raises its voice, and it is the honest
             *    place — tasteMatch.ts already argues that "the evidence is the
             *    product, the number is noise", and three unlabelled digits
             *    beside three glyphs were neither.
             *
             * 3. Follow is a pill sized to its word. It is one action among a
             *    grid of six, and a full-bleed fill in the brand colour, six
             *    times over, shouted louder than anything beside it.
             *
             * `h-full` with an `mt-auto` footer keeps the tally and the button
             * on one line across a row whether or not a person wrote a bio —
             * the ragged edge was the bio pushing them out of alignment.
             */
            <div
              key={item.id}
              className="group flex h-full flex-col rounded-2xl border border-surface-800 bg-surface-900/40 p-5 transition-colors duration-200 hover:border-surface-700 hover:bg-surface-900/70"
            >
              <Link
                href={`/app/profile/${item.username}`}
                className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
              >
                <Avatar src={item.avatar_url} name={item.username} size={44} />
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-white transition-colors group-hover:text-brand-300">
                    @{item.username}
                  </h2>
                  {item.followsYou && (
                    <span className="text-[11px] text-surface-500">Follows you</span>
                  )}
                </div>
              </Link>

              {item.about && (
                <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-surface-400">
                  {item.about}
                </p>
              )}

              {/* Stacked, not side by side. The tally and the pill on one line
                  fit in the mock and not in the grid: at four columns a card is
                  about 264px, the three labels alone need more than that, and
                  the button was pushed clean outside the card onto its
                  neighbour. Giving each its own row costs one line of height
                  and is the difference between a layout that holds at every
                  breakpoint and one that holds at the width I happened to
                  design it at. A three-column grid rather than a wrapping flex
                  row, so the tally is always one line and never breaks two-up
                  with an orphan. */}
              <div className="mt-auto pt-5">
                <dl className="grid grid-cols-3 gap-2">
                  {([
                    ["Watched", item.user_cout_stats?.watched_count],
                    ["Favorites", item.user_cout_stats?.favorites_count],
                    ["Watchlist", item.user_cout_stats?.watchlist_count],
                  ] as const).map(([label, value]) => (
                    <div key={label}>
                      <dd className="text-[15px] font-semibold tabular-nums leading-none text-surface-100">
                        {value ?? 0}
                      </dd>
                      <dt className="mt-1 text-[10px] uppercase tracking-[0.08em] text-surface-500">
                        {label}
                      </dt>
                    </div>
                  ))}
                </dl>

                <FollowButton
                  targetUserId={item.id}
                  currentUserId={authUser?.id ?? null}
                  initialStatus={item.isFollowing ? "following" : "follow"}
                  size="sm"
                  emphasis="quiet"
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
