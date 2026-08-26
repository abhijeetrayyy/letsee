"use client";

import { useState } from "react";
import useSWR from "swr";
import { useInView } from "@/hooks/useInView";
import toast from "react-hot-toast";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import Link from "@components/ui/AppLink";
import { Play, ChevronRight, Tv, Check, Loader2 } from "lucide-react";
import EmptyState from "@components/ui/EmptyState";
import { titlePath } from "@/utils/urls";

const continueWatchingFetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());

interface ContinueWatchingItem {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  next_season: number | null;
  next_episode: number | null;
  episodes_watched: number;
  total_episodes: number;
  tv_status: string | null;
  is_caught_up: boolean;
  last_air_date: string | null;
  next_air_date: string | null;
  up_next: { s: number; e: number }[];
  can_mark_next: boolean;
}

export default function ContinueWatchingProgress() {
  const { isAuthenticated } = useMediaInteraction();
  /**
   * `/api/continue-watching` resolves each tracked show's next episode against
   * TMDB. Worth doing for someone who is looking at the rail; not worth doing
   * for the majority of home page views that stop above it.
   */
  const { ref, inView } = useInView<HTMLDivElement>();

  const { data, isLoading, mutate } = useSWR<{ items: ContinueWatchingItem[] }>(
    isAuthenticated && inView ? "/api/continue-watching" : null,
    continueWatchingFetcher,
  );
  const items = data?.items ?? [];
  const loading = isAuthenticated && (!inView || isLoading);

  /** Keyed per show — this is a horizontal rail, and one pending mark must not freeze the others. */
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  /**
   * Mark the next episode, without leaving the page.
   *
   * Uses `/api/watched-episodes-bulk`, not `/api/watched-episode`. The latter
   * is a *toggle* — it selects, then deletes if found — so a double tap, a
   * retry, or a lost response silently **un-marks** the episode. The bulk route
   * upserts with `ignoreDuplicates`, which makes it idempotent and safe to
   * repeat, and it carries the intent explicitly rather than depending on what
   * the server already had.
   *
   * The advance is optimistic and exact: `up_next` comes from the server's own
   * season grid, so the card knows whether S4E5 is followed by S4E6 or S5E1.
   */
  const markNext = async (item: ContinueWatchingItem) => {
    const next = item.up_next?.[0];
    if (!next || busy[item.show_id]) return;
    setBusy((b) => ({ ...b, [item.show_id]: true }));

    const optimistic = {
      items: items.map((i) =>
        i.show_id === item.show_id
          ? {
              ...i,
              up_next: i.up_next.slice(1),
              episodes_watched: i.episodes_watched + 1,
              next_season: i.up_next[1]?.s ?? null,
              next_episode: i.up_next[1]?.e ?? null,
              is_caught_up: i.up_next.length <= 1,
            }
          : i,
      ),
    };
    mutate(optimistic, { revalidate: false });

    try {
      const res = await fetch("/api/watched-episodes-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: item.show_id,
          episodes: [{ season_number: next.s, episode_number: next.e }],
          action: "mark",
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Roll back rather than leave the card claiming something that did not
      // save — SWR revalidates on focus, so a silent failure would otherwise
      // snap back later with no explanation.
      mutate();
      toast.error("That didn't save. Check your connection.");
    } finally {
      setBusy((b) => ({ ...b, [item.show_id]: false }));
    }
  };

  if (loading) {
    return (
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="shrink-0 w-44 animate-pulse">
            <div className="aspect-[2/3] rounded-xl bg-surface-800" />
            <div className="mt-2 h-3 bg-surface-800 rounded w-3/4" />
            <div className="mt-1 h-2 bg-surface-800 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        icon={<Tv className="size-8" />}
        title="Nothing in progress"
        description="Shows you start watching will pick up here, so you always know what's next."
        actionLabel="Find something"
        actionHref="/app/search"
        className="!py-8 rounded-xl border border-surface-700/40 bg-surface-900/30"
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <h2 className="text-xl font-bold text-white tracking-tight">Continue Watching</h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 scrollbar-thin">
        {items.slice(0, 8).map((item) => (
          // The button cannot live inside the Link — a <button> inside an <a>
          // is invalid HTML — so the card is a div holding both.
          <div key={item.show_id} className="shrink-0 w-44 group relative">
          <Link href={titlePath("tv", item.show_id, item.show_name)} className="block">
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-800">
              {item.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                  alt={item.show_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Tv className="size-10 text-surface-600" />
                </div>
              )}

              {/* Progress bar at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-700">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((item.episodes_watched / Math.max(1, item.total_episodes)) * 100))}%`,
                  }}
                />
              </div>

              {/* Next episode badge */}
              {item.next_season != null && item.next_episode != null && (
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-white flex items-center gap-1">
                  <Play className="size-3 fill-white" />
                  S{item.next_season}E{item.next_episode}
                </div>
              )}

              {item.is_caught_up && (
                <div className="absolute top-2 right-2 bg-amber-500/80 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-white">
                  Caught up
                </div>
              )}
            </div>

            <h3 className="mt-2 text-sm font-medium text-white truncate">{item.show_name}</h3>
            <p className="text-xs text-surface-400">
              {item.episodes_watched}/{item.total_episodes} episodes
              {item.is_caught_up && item.next_air_date && (
                <span className="text-amber-400 ml-1">
                  · {new Date(item.next_air_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </p>
          </Link>

          {/* One tap, from wherever you already are. Labelled with the exact
              episode so it is never a guess about what you are agreeing to. */}
          {item.can_mark_next && item.up_next?.[0] && (
            <button
              type="button"
              onClick={() => markNext(item)}
              disabled={busy[item.show_id]}
              aria-label={`Mark ${item.show_name} season ${item.up_next[0].s} episode ${item.up_next[0].e} as watched`}
              className="mt-2 flex w-full min-h-[40px] touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-brand-500/20 px-2 py-2 text-xs font-semibold text-brand-400 transition-colors hover:bg-brand-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy[item.show_id] ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Watched S{item.up_next[0].s}E{item.up_next[0].e}
            </button>
          )}
          </div>
        ))}

        {items.length > 8 && (
          <Link
            href="/app/profile"
            className="shrink-0 w-44 flex items-center justify-center rounded-xl border-2 border-dashed border-surface-700 hover:border-brand-500/50 transition-colors group"
          >
            <div className="text-center">
              <ChevronRight className="size-8 text-surface-500 group-hover:text-brand-400 mx-auto transition-colors" />
              <p className="mt-2 text-sm text-surface-400 group-hover:text-brand-400">View all</p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
