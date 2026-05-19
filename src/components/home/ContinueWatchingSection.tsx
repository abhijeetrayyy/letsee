"use client";

import React, { useEffect, useState, useContext } from "react";
import Link from "next/link";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { FaCheck } from "react-icons/fa";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import MarkTVWatchedModal from "@components/tv/MarkTVWatchedModal";

interface ContinueItem {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  next_season: number | null;
  next_episode: number | null;
  episodes_watched: number;
  total_episodes: number;
  tv_status?: string | null;
  is_caught_up: boolean;
  last_air_date: string | null;
  next_air_date: string | null;
  item_type: "tv";
}

interface WatchingItem {
  item_id: string;
  item_name: string;
  item_type: "tv" | "movie";
  image_url: string | null;
  started_at: string;
}

type UnifiedItem = (
  | (ContinueItem & { source: "continue" })
  | (WatchingItem & { source: "watching" })
) & {
  sortDate: number;
};

export default function ContinueWatchingSection() {
  const { user } = useContext(UserPrefrenceContext);
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [tvModalOpen, setTvModalOpen] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { refreshPreferences } = useContext(UserPrefrenceContext);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [continueRes, watchingRes] = await Promise.all([
        fetch("/api/continue-watching", { cache: "no-store" }).then((r) =>
          r.json()
        ),
        fetch(`/api/currently-watching`, {
          cache: "no-store",
        }).then((r) => r.json()),
      ]);

      const continueItems: ContinueItem[] = continueRes?.items || [];
      const watchingItems: WatchingItem[] = watchingRes?.items || [];

      const continueMap = new Map(continueItems.map((i) => [i.show_id, i]));
      const merged: UnifiedItem[] = [];

      continueItems.forEach((item) => {
        merged.push({
          ...item,
          item_type: "tv",
          source: "continue",
          sortDate: 0,
        });
      });

      watchingItems.forEach((item) => {
        if (item.item_type === "tv" && continueMap.has(item.item_id)) {
          return;
        }
        merged.push({
          ...item,
          source: "watching",
          sortDate: new Date(item.started_at).getTime(),
        });
      });

      setItems(merged);
    } catch (error) {
      console.error("Failed to fetch continue watching data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleMarkNext = async (e: React.MouseEvent, item: ContinueItem) => {
    e.preventDefault();
    e.stopPropagation();

    if (!item.next_season || !item.next_episode) return;

    setMarking(item.show_id);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: item.show_id,
          seasonNumber: item.next_season,
          episodeNumber: item.next_episode,
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to mark episode", error);
    } finally {
      setMarking(null);
    }
  };

  if (loading) return null;

  const isRecent = (dateStr: string | null) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 14;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <section
      className="animate-fade-up"
      aria-labelledby="continue-watching-heading"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <h2
          id="continue-watching-heading"
          className="text-xl sm:text-2xl font-bold text-white tracking-tight"
        >
          <Link
            href="/app/profile"
            className="group inline-flex items-center gap-2 hover:text-brand-400 transition-colors"
          >
            Jump Back In
          </Link>
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 rounded-2xl bg-surface-900/30 border border-dashed border-surface-700/40">
          <p className="text-surface-500 text-sm text-center">
            You haven&apos;t started any shows or movies yet. Explore titles to
            see them here!
          </p>
          <Link
            href="/app/search/discover"
            className="mt-4 btn-secondary"
          >
            Explore Popular
          </Link>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar pretty-scrollbar">
          {items.map((item) => {
            if (item.source === "continue") {
              const cItem = item as ContinueItem & { source: "continue" };
              const posterUrl = cItem.poster_path
                ? `https://image.tmdb.org/t/p/w185${cItem.poster_path}`
                : "/no-photo.webp";

              const nextUrl = cItem.is_caught_up
                ? `/app/tv/${cItem.show_id}`
                : `/app/tv/${cItem.show_id}/season/${cItem.next_season}/episode/${cItem.next_episode}`;

              const progress =
                cItem.total_episodes > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (cItem.episodes_watched / cItem.total_episodes) * 100
                      )
                    )
                  : 0;

              const hasNewEpisodes =
                !cItem.is_caught_up && isRecent(cItem.last_air_date);

              return (
                <div
                  key={`continue-${cItem.show_id}`}
                  className="relative group shrink-0 w-36 sm:w-44 flex flex-col"
                >
                  <Link
                    href={nextUrl}
                    className="block rounded-xl overflow-hidden border border-surface-700/40 bg-surface-900/60 hover:border-surface-600/60 transition-all duration-200"
                  >
                    <div className="relative aspect-2/3 w-full overflow-hidden">
                      <img
                        src={posterUrl}
                        alt={cItem.show_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {cItem.tv_status && (
                        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide shadow-sm
                           ${
                             cItem.tv_status === "watching"
                               ? "bg-brand-500/90 text-surface-950"
                               : cItem.tv_status === "rewatching"
                                 ? "bg-blue-500/90 text-white"
                                 : "bg-surface-600/90 text-white"
                           }`}
                          >
                            {cItem.tv_status === "rewatching" ? "Rewatch" : ""}
                          </span>
                          {hasNewEpisodes && (
                            <span className="px-1.5 py-0.5 rounded bg-accent-gold/90 text-surface-950 text-[10px] font-bold uppercase tracking-wide shadow-sm animate-pulse">
                              NEW EP
                            </span>
                          )}
                        </div>
                      )}

                      {cItem.is_caught_up && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                          <span className="bg-surface-800/90 text-surface-200 px-3 py-1 rounded-full text-xs font-medium border border-surface-600 whitespace-nowrap">
                            Caught Up
                          </span>
                          {cItem.next_air_date && (
                            <span className="text-[10px] uppercase font-bold text-accent-gold bg-black/50 px-2 py-0.5 rounded">
                              Returns {formatDate(cItem.next_air_date)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                      {!cItem.is_caught_up && (
                        <div className="absolute bottom-3 left-3 right-3 z-10">
                          <span className="text-xs font-semibold text-white/90 block mb-1">
                            S{cItem.next_season} E{cItem.next_episode}
                          </span>
                          <div className="w-full h-1 bg-surface-700/50 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {!cItem.is_caught_up && (
                        <button
                          onClick={(e) => handleMarkNext(e, cItem)}
                          disabled={marking === cItem.show_id}
                          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-brand-500 text-surface-950 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 focus:opacity-100 disabled:opacity-50 z-20 shadow-lg"
                          title="Mark next episode as watched"
                        >
                          {marking === cItem.show_id ? (
                            <span className="animate-spin text-xs">⏳</span>
                          ) : (
                            <FaCheck size={12} />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="p-3 flex-1 min-h-0">
                      <p className="text-sm font-semibold text-surface-100 line-clamp-1 group-hover:text-brand-400 transition-colors">
                        {cItem.show_name}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5 font-medium">
                        {cItem.is_caught_up
                          ? "All caught up"
                          : `${cItem.episodes_watched} of ${cItem.total_episodes} watched`}
                      </p>
                    </div>
                  </Link>

                  <div className="border border-surface-700/40 border-t-0 rounded-b-xl overflow-hidden bg-surface-900/80">
                    <ThreePrefrenceBtn
                      variant="compact"
                      cardId={cItem.show_id}
                      cardType="tv"
                      cardName={cItem.show_name}
                      cardImg={cItem.poster_path}
                      genres={[]}
                      onAddWatchedTv={() =>
                        setTvModalOpen({
                          id: cItem.show_id,
                          name: cItem.show_name,
                        })
                      }
                    />
                  </div>
                </div>
              );
            } else {
              const wItem = item as WatchingItem & { source: "watching" };
              const posterUrl =
                wItem.image_url && wItem.image_url.length > 1
                  ? `https://image.tmdb.org/t/p/w185${wItem.image_url}`
                  : "/no-photo.webp";
              const href =
                wItem.item_type === "tv"
                  ? `/app/tv/${wItem.item_id}`
                  : `/app/movie/${wItem.item_id}`;

              return (
                <div
                  key={`watching-${wItem.item_id}`}
                  className="shrink-0 w-36 sm:w-44 flex flex-col group"
                >
                  <Link
                    href={href}
                    className="block rounded-xl overflow-hidden border border-surface-700/40 bg-surface-900/60 hover:border-surface-600/60 transition-all duration-200"
                  >
                    <div className="relative aspect-2/3 w-full overflow-hidden">
                      <img
                        src={posterUrl}
                        alt={wItem.item_name ?? ""}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute top-2 left-2">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/90 text-white text-[10px] font-bold uppercase tracking-wide shadow-sm">
                          {wItem.item_type === "tv" ? "TV" : "Movie"}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 flex-1 min-h-0">
                      <p className="text-sm font-semibold text-surface-100 line-clamp-1 group-hover:text-brand-400 transition-colors">
                        {wItem.item_name}
                      </p>
                      {wItem.item_type === "tv" && (
                        <p className="text-xs text-surface-500 mt-0.5">
                          Start watching
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="border border-surface-700/40 border-t-0 rounded-b-xl overflow-hidden bg-surface-900/80">
                    <ThreePrefrenceBtn
                      variant="compact"
                      cardId={wItem.item_id}
                      cardType={wItem.item_type}
                      cardName={wItem.item_name}
                      cardImg={wItem.image_url}
                      genres={[]}
                      onAddWatchedTv={
                        wItem.item_type === "tv"
                          ? () =>
                              setTvModalOpen({
                                id: wItem.item_id,
                                name: wItem.item_name,
                              })
                          : undefined
                      }
                    />
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}

      {tvModalOpen && (
        <MarkTVWatchedModal
          showId={tvModalOpen.id}
          showName={tvModalOpen.name}
          seasons={[]}
          isOpen={!!tvModalOpen}
          onClose={() => setTvModalOpen(null)}
          onSuccess={() => {
            setTvModalOpen(null);
            refreshPreferences?.();
            fetchData();
          }}
          watchedPayload={{
            itemId: Number(tvModalOpen.id),
            name: tvModalOpen.name,
            imgUrl: "",
            adult: false,
            genres: [],
          }}
        />
      )}
    </section>
  );
}
