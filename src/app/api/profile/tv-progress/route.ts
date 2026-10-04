import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";
import { getAuthUserId } from "@/utils/apiAuth";

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 150;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    // Auth & Permission Check
    const authUserId = await getAuthUserId();
    const viewerId = authUserId ?? null;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("visibility")
      .eq("id", userId)
      .maybeSingle();

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

    if (!process.env.TMDB_API_KEY) {
      return jsonError("TMDB API key is missing", 500);
    }

    // 1. Aggregate show IDs from user_media_status (canonical) plus any
    // watched_episodes rows that predate a show having a status row.
    const [statusRes, watchedEpRes] = await Promise.all([
      supabase
        .from("user_media_status")
        .select("item_id, status, updated_at")
        .eq("user_id", userId)
        .eq("item_type", "tv"),
      // Every show id, past the 1,000-row default (an account can have
      // thousands of watched episodes).
      fetchAllRows<{ show_id: string }>((from, to) =>
        supabase.from("watched_episodes").select("show_id").eq("user_id", userId).order("id", { ascending: true }).range(from, to),
      ).then(({ rows, error }) => ({ data: rows, error })),
    ]);

    const taggedData = statusRes.data ?? [];
    const statusMap = new Map<string, string>();
    const timeMap = new Map<string, string>();
    for (const item of taggedData) {
      statusMap.set(String(item.item_id), item.status);
      timeMap.set(String(item.item_id), item.updated_at);
    }

    const allIds = new Set<string>();
    taggedData.forEach((r) => allIds.add(String(r.item_id)));
    (watchedEpRes.data ?? []).forEach((r) => allIds.add(String(r.show_id)));

    let filteredIds: string[] = [];

    if (statusFilter === "untagged") {
      // Only items that have no user_media_status row (tracked via episodes only)
      filteredIds = Array.from(allIds).filter((id) => !statusMap.has(id));
    } else if (statusFilter) {
      // One status, or several comma-separated: "Stopped" is on_hold and dropped.
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

    const items: ProfileTvProgressItem[] = [];

    // 2. Fetch details for the slice in batches to avoid overwhelming TMDB/Network
    for (let i = 0; i < slice.length; i += BATCH_SIZE) {
      const batch = slice.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (showId) => {
          const [watchedRes, showData] = await Promise.all([
            fetchAllRows<{ season_number: number; episode_number: number }>((from, to) =>
              supabase
                .from("watched_episodes")
                .select("season_number, episode_number")
                .eq("user_id", userId)
                .eq("show_id", showId)
                .order("season_number", { ascending: true })
                .order("episode_number", { ascending: true })
                .range(from, to),
            ).then(({ rows, error }) => ({ data: rows, error })),
            getTvShowWithSeasons(showId),
          ]);

          if (watchedRes.error) {
            console.error(`DB error for show ${showId}:`, watchedRes.error);
            return null;
          }
          if (!showData) {
            console.warn(`TMDB data missing for show ${showId}`);
            return null;
          }

          const watchedSet = new Set(
            (watchedRes.data ?? []).map(
              (r) => `${r.season_number},${r.episode_number}`,
            ),
          );
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
        }),
      );

      for (const item of batchResults) {
        if (item) items.push(item);
      }

      if (i + BATCH_SIZE < slice.length) await delay(BATCH_DELAY_MS);
    }

    return jsonSuccess({ items, total }, { maxAge: 0 });
  } catch (err: any) {
    console.error("Critical TV Progress API error:", err);
    return jsonError(
      err.message || String(err) || "Internal Server Error",
      500,
    );
  }
}
