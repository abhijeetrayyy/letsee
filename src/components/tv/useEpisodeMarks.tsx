"use client";

import { useCallback, useContext, useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { swrFetcher } from "@/utils/swrFetcher";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { earlierUnwatched, epKey, rangeLabel, type Ep, type SeasonInfo } from "@/lib/logging/episodes";

type WatchedRow = { season_number: number; episode_number: number; watched_at?: string };

/**
 * Marking episodes, one way everywhere (the series page's season panel and
 * the season page).
 *
 * - One tap toggles an episode; the check moves at once and goes back if the
 *   write fails.
 * - Ticking an episode with unmarked ones behind it offers "Mark E01–E04
 *   too" — never does it for you, because skipping is real (PAGES.md, the
 *   season page). Doing it says so, with Undo.
 * - "Mark the season" marks only what isn't marked, so Undo removes exactly
 *   those and nothing you'd marked before.
 *
 * Watched state lives on the SWR key every other episode surface shares
 * (`/api/watched-episodes?showId=`), and each write refreshes the providers
 * too, because the route re-derives the show's status (Watching, Watched).
 */
export function useEpisodeMarks(showId: string, opts: { seasons: SeasonInfo[]; lastAired: Ep | null; enabled: boolean }) {
  const { seasons, lastAired, enabled } = opts;
  const { data, mutate } = useSWR<{ episodes?: WatchedRow[] }>(enabled ? `/api/watched-episodes?showId=${showId}` : null, swrFetcher);
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const { refresh: refreshInteractions } = useMediaInteraction();
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const watched = useMemo(() => new Set((data?.episodes ?? []).map((r) => epKey(r.season_number, r.episode_number))), [data]);
  const isWatched = useCallback((s: number, e: number) => {
    const k = epKey(s, e);
    return k in pending ? pending[k] : watched.has(k);
  }, [pending, watched]);

  const refresh = useCallback(async () => {
    const [fresh] = await Promise.all([mutate(), refreshPreferences(), refreshInteractions()]).catch(() => [undefined]);
    return new Set((fresh?.episodes ?? []).map((r: WatchedRow) => epKey(r.season_number, r.episode_number)));
  }, [mutate, refreshPreferences, refreshInteractions]);

  const bulk = useCallback(async (eps: Ep[], mark: boolean) => {
    const episodes = eps.map((ep) => ({ season_number: ep.s, episode_number: ep.e }));
    const res = await fetch(mark ? "/api/watched-episodes-bulk" : "/api/watched-episodes/bulk-delete", {
      method: mark ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mark ? { showId, episodes, action: "mark" } : { showId, episodes }),
    }).catch(() => null);
    return !!res?.ok;
  }, [showId]);

  const hold = useCallback((eps: Ep[], value: boolean | null) =>
    setPending((p) => {
      const next = { ...p };
      for (const ep of eps) {
        if (value === null) delete next[epKey(ep.s, ep.e)];
        else next[epKey(ep.s, ep.e)] = value;
      }
      return next;
    }), []);

  /** Mark or unmark a set, saying so with Undo. */
  const apply = useCallback(async (eps: Ep[], mark: boolean, said: string) => {
    if (!eps.length) return;
    hold(eps, mark);
    const ok = await bulk(eps, mark);
    if (!ok) {
      hold(eps, null);
      toast.error("That didn't save. Check your connection.");
      return;
    }
    await refresh();
    hold(eps, null);
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          {said}
          <button
            type="button"
            className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
            onClick={async () => {
              toast.dismiss(t.id);
              hold(eps, !mark);
              const undone = await bulk(eps, !mark);
              if (undone) await refresh();
              else toast.error("Couldn't undo that.");
              hold(eps, null);
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  }, [bulk, refresh, hold]);

  const toggle = useCallback(async (ep: Ep) => {
    const was = isWatched(ep.s, ep.e);
    hold([ep], !was);
    const res = await fetch("/api/watched-episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId, seasonNumber: ep.s, episodeNumber: ep.e }),
    }).catch(() => null);
    if (!res?.ok) {
      hold([ep], null);
      toast.error("That didn't save. Check your connection.");
      return;
    }
    const now = await refresh();
    hold([ep], null);
    if (was) return;
    const gaps = earlierUnwatched(seasons, now.size ? now : new Set([...watched, epKey(ep.s, ep.e)]), ep, lastAired);
    if (!gaps.length) return;
    const label = rangeLabel(gaps);
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          {gaps.length === 1 ? `${label} isn't marked.` : `${label} aren't marked.`}
          <button
            type="button"
            className="shrink-0 rounded-full bg-action px-3 py-1 font-medium text-on-action"
            onClick={() => {
              toast.dismiss(t.id);
              void apply(gaps, true, `Marked ${label}`);
            }}
          >
            Mark them
          </button>
        </span>
      ),
      { duration: 8000 },
    );
  }, [isWatched, hold, showId, refresh, seasons, watched, lastAired, apply]);

  const markAll = useCallback((eps: Ep[]) => {
    const todo = eps.filter((ep) => !isWatched(ep.s, ep.e));
    if (todo.length) void apply(todo, true, `Marked ${todo.length} ${todo.length === 1 ? "episode" : "episodes"}`);
  }, [isWatched, apply]);

  const watchedAt = useCallback((s: number, e: number) => data?.episodes?.find((r) => r.season_number === s && r.episode_number === e)?.watched_at ?? null, [data]);

  return { ready: data !== undefined, watched, isWatched, pending, toggle, markAll, watchedAt };
}
