import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { getAuthUserId } from "@/utils/apiAuth";
import { tmdbConfigured } from "@/utils/tmdbClient";


import { guard } from "@/lib/limits/guard";
export type ProfileTvProgressItem = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  seasons_completed: number;
  episodes_watched: number;
  total_episodes: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
  /** Everything *aired* is watched, but the show hasn't finished. */
  caught_up: boolean;
  next_air_date: string | null;
  /** user_media_status status: watchlist | watching | watched | on_hold | dropped */
  tv_status: string | null;
};

export async function GET(req: NextRequest) {
  const limited = await guard("heavy", req);
  if (limited) return limited;
  try {
    const supabase = await createClient();
    const userId = req.nextUrl.searchParams.get("userId")?.trim();
    const limit = Math.min(
      Math.max(Number(req.nextUrl.searchParams.get("limit")) || 10, 1),
      50,
    );
    const offset = Math.max(
      Number(req.nextUrl.searchParams.get("offset")) || 0,
      0,
    );
    const statusFilter = req.nextUrl.searchParams.get("status")?.trim();

    if (!userId) {
      return jsonError("userId query parameter is required", 400);
    }

    /**
     * Two rounds of reads, not dozens (migration 120). The profile check and
     * the list of shows go out together; then, for the page's shows, their
     * watched episodes (one row per season) and their TMDB details together.
     * It used to read every watched episode the account had, a thousand at a
     * time, to learn which shows it had — 4.5 s before the first show for an
     * account with 9,000 episodes — and then each show's episodes one show at
     * a time, three at once with a pause between.
     */
    const authUserId = await getAuthUserId();
    const viewerId = authUserId ?? null;

    const [{ data: profile, error: profileError }, showsRes] = await Promise.all([
      supabase.from("users").select("visibility").eq("id", userId).maybeSingle(),
      // Under the caller's RLS, as the table reads it replaces were.
      supabase.rpc("tv_progress_shows", { p_user: userId }),
    ]);

    if (profileError || !profile) {
      return jsonError("User not found", 404);
    }

    const visibility = String(profile.visibility ?? "public")
      .toLowerCase()
      .trim();
    const canView =
      viewerId === userId ||
      visibility === "public" ||
      (visibility === "followers" &&
        viewerId &&
        (
          await supabase
            .from("user_connections")
            .select("id")
            .eq("follower_id", viewerId)
            .eq("followed_id", userId)
            .maybeSingle()
        ).data?.id);

    if (!canView) {
      return jsonError("Forbidden", 403);
    }

    if (!tmdbConfigured()) {
      return jsonError("TMDB_READ_TOKEN is missing", 500);
    }
    if (showsRes.error) {
      return jsonError("Couldn't read series progress", 500);
    }

    const shows = (showsRes.data ?? []) as { show_id: string; status: string | null; updated_at: string | null }[];
    const statusMap = new Map<string, string>();
    const timeMap = new Map<string, string>();
    const allIds = new Set<string>();
    for (const row of shows) {
      const id = String(row.show_id);
      allIds.add(id);
      if (row.status) statusMap.set(id, row.status);
      if (row.updated_at) timeMap.set(id, row.updated_at);
    }

    let filteredIds: string[] = [];

    if (statusFilter === "untagged") {
      // Only items that have no user_media_status row (tracked via episodes only)
      filteredIds = Array.from(allIds).filter((id) => !statusMap.has(id));
    } else if (statusFilter) {
      // One status, or several comma-separated (on_hold,dropped).
      const wanted = new Set(statusFilter.split(",").map((s) => s.trim()));
      filteredIds = Array.from(allIds).filter((id) => wanted.has(statusMap.get(id) ?? ""));
    } else {
      // All items
      filteredIds = Array.from(allIds);
    }

    // Sort: Tagged items by updated_at (desc), others at end
    filteredIds.sort((a, b) => {
      const timeA = timeMap.get(a) || "0";
      const timeB = timeMap.get(b) || "0";
      const byTime = timeB.localeCompare(timeA);
      // Ties are common here — every episode-only show has no updated_at and
      // collapses to "0" — and the ids come from two unordered queries via a
      // Set, so tied entries had no stable order. Since this slices in memory
      // for pagination, that let rows repeat or vanish between pages.
      return byTime !== 0 ? byTime : a.localeCompare(b);
    });

    const total = filteredIds.length;
    const slice = filteredIds.slice(offset, offset + limit);

    if (slice.length === 0) {
      return jsonSuccess({ items: [], total }, { maxAge: 0 });
    }

    // The page's watched episodes in one read, and every show's TMDB details
    // at once — fetchTmdb throttles itself, and getTvShowWithSeasons is cached.
    const [episodesRes, details] = await Promise.all([
      supabase.rpc("tv_progress_episodes", { p_user: userId, p_shows: slice }),
      Promise.all(slice.map((id) => getTvShowWithSeasons(id).catch(() => null))),
    ]);
    if (episodesRes.error) {
      return jsonError("Couldn't read series progress", 500);
    }
    const watchedByShow = new Map<string, Set<string>>();
    for (const row of (episodesRes.data ?? []) as { show_id: string; season_number: number; episodes: number[] }[]) {
      const set = watchedByShow.get(String(row.show_id)) ?? new Set<string>();
      for (const e of row.episodes ?? []) set.add(`${row.season_number},${e}`);
      watchedByShow.set(String(row.show_id), set);
    }

    const items: ProfileTvProgressItem[] = slice
      .map((showId, i): ProfileTvProgressItem | null => {
          const showData = details[i];
          if (!showData) {
            console.warn(`TMDB data missing for show ${showId}`);
            return null;
          }
          const watchedSet = watchedByShow.get(showId) ?? new Set<string>();
          const name = (showData?.name as string) ?? "Unknown Show";
          const poster = (showData?.poster_path as string) ?? null;

          const seasons = Array.isArray(showData?.seasons)
            ? showData.seasons
            : [];
          const seasonCounts = new Map<number, number>();
          const allEpisodes: { s: number; e: number }[] = [];

          for (const season of seasons) {
            const sn = Number((season as any).season_number);
            if (sn <= 0 || Number.isNaN(sn)) continue; // Skip specials (season 0)
            const count = Number((season as any).episode_count) || 0;
            seasonCounts.set(sn, count);
            for (let ep = 1; ep <= count; ep++) {
              allEpisodes.push({ s: sn, e: ep });
            }
          }

          allEpisodes.sort((a, b) => a.s - b.s || a.e - b.e);

          // Only episodes TMDB lists in a regular season count toward "N of M":
          // specials, and numbering an import brought in that TMDB doesn't
          // have, used to push Game of Thrones to "368 of 73".
          const episodesWatched = allEpisodes.filter(({ s, e }) => watchedSet.has(`${s},${e}`)).length;

          let seasonsCompleted = 0;
          for (const [sn, totalEp] of seasonCounts.entries()) {
            let w = 0;
            for (let ep = 1; ep <= totalEp; ep++) {
              if (watchedSet.has(`${sn},${ep}`)) w++;
            }
            if (totalEp > 0 && w >= totalEp) seasonsCompleted++;
          }

          /**
           * "Caught up" is not the same as "finished": every episode TMDB
           * lists may include announced ones, so the waterline is
           * last_episode_to_air. The next episode offered is the first
           * unwatched one that has aired — never an announcement — and a
           * special named as the last to air says nothing about the regular
           * seasons, so it is ignored.
           */
          const lastAired = (showData as any)?.last_episode_to_air as
            | { season_number?: number; episode_number?: number }
            | null;
          const nextToAir = (showData as any)?.next_episode_to_air as
            | { air_date?: string }
            | null;
          const ls = Number(lastAired?.season_number ?? 0);
          const le = Number(lastAired?.episode_number ?? 0);
          const aired = ls > 0 ? allEpisodes.filter(({ s, e }) => s < ls || (s === ls && e <= le)) : allEpisodes;
          const allComplete = allEpisodes.every(({ s, e }) => watchedSet.has(`${s},${e}`));
          const nextEp = aired.find(({ s, e }) => !watchedSet.has(`${s},${e}`));
          // Everything out is watched, and more is listed or coming.
          const caughtUp = !allComplete && !nextEp && (ls > 0 || !!nextToAir);

          return {
            show_id: showId,
            show_name: name,
            poster_path: poster,
            seasons_completed: seasonsCompleted,
            episodes_watched: episodesWatched,
            total_episodes: allEpisodes.length,
            next_season: nextEp?.s ?? null,
            next_episode: nextEp?.e ?? null,
            all_complete: allComplete,
            caught_up: caughtUp,
            next_air_date: nextToAir?.air_date ?? null,
            tv_status: statusMap.get(showId) ?? null,
          } as ProfileTvProgressItem;
        })
      .filter((item): item is ProfileTvProgressItem => item !== null);

    return jsonSuccess({ items, total }, { maxAge: 0 });
  } catch (err: any) {
    console.error("Critical TV Progress API error:", err);
    return jsonError(
      err.message || String(err) || "Internal Server Error",
      500,
    );
  }
}
