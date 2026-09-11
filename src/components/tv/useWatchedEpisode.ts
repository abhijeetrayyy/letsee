"use client";

import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";
import { useAuth } from "@/app/contextAPI/AuthProvider";

/**
 * Has the viewer watched one episode of a show?
 *
 * One SWR entry per show, keyed exactly as ProgressRibbon and SeasonBrowser
 * key theirs, so the four spoiler gates and the mark button on an episode
 * page share a single request — and a series page's warm cache carries over
 * on client navigation. `mutate` after the write and every consumer updates
 * at once; there is no event bus.
 *
 * `watched` is null until the answer is known (signed-out resolves to false
 * immediately), so a gate can hold its content back rather than flash it.
 */
export function useWatchedEpisode(showId: string, seasonNumber: number, episodeNumber: number) {
  const { user, ready } = useAuth();
  const key = ready && user ? `/api/watched-episodes?showId=${showId}` : null;
  const { data, mutate, isLoading } = useSWR<{ episodes?: { season_number: number; episode_number: number }[] }>(
    key,
    swrFetcher,
  );
  const watched: boolean | null = !ready
    ? null
    : !user
      ? false
      : isLoading || data === undefined
        ? null
        : (data.episodes ?? []).some((e) => e.season_number === seasonNumber && e.episode_number === episodeNumber);
  return { watched, mutate, signedIn: !!user, ready };
}
