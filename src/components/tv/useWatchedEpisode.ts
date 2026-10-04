"use client";

import { useCallback, useContext, useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";

/**
 * Has the viewer watched one episode of a show?
 *
 * One SWR entry per show, keyed exactly as ProgressRibbon and SeasonBrowser
 * key theirs, so the spoiler gates and the mark button on an episode page
 * share a single request — and a series page's warm cache carries over on
 * client navigation. `mutate` after the write and every consumer updates at
 * once; there is no event bus.
 *
 * `watched` is null until the answer is known (signed-out resolves to false
 * immediately), so a gate can hold its content back rather than flash it.
 */
export function useWatchedEpisode(showId: string, seasonNumber: number, episodeNumber: number) {
  const { user, ready } = useAuth();
  const key = ready && user ? `/api/watched-episodes?showId=${showId}` : null;
  const { data, mutate, isLoading, error } = useSWR<{ episodes?: { season_number: number; episode_number: number; watched_at?: string }[] }>(
    key,
    swrFetcher,
  );
  const row = (data?.episodes ?? []).find((e) => e.season_number === seasonNumber && e.episode_number === episodeNumber);
  // A failed read counts as not watched, so the gate still offers Show anyway
  // rather than holding a placeholder forever.
  const watched: boolean | null = !ready ? null : !user ? false : error ? false : isLoading || data === undefined ? null : !!row;
  return { watched, watchedAt: row?.watched_at ?? null, mutate, signedIn: !!user, ready };
}

/**
 * The same, plus the one write: mark or unmark this episode. The route
 * toggles and re-derives the show's status, so the providers refresh too.
 */
export function useMarkEpisode(showId: string, seasonNumber: number, episodeNumber: number) {
  const state = useWatchedEpisode(showId, seasonNumber, episodeNumber);
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const [busy, setBusy] = useState(false);
  const { mutate } = state;
  const toggle = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await fetch("/api/watched-episode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, seasonNumber, episodeNumber }),
      });
      if (!res.ok) return false;
      await Promise.all([mutate(), refreshPreferences()]).catch(() => {});
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [showId, seasonNumber, episodeNumber, mutate, refreshPreferences]);
  return { ...state, toggle, busy };
}
