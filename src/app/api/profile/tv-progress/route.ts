import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getTvShowWithSeasons } from "@/utils/tmdbTvShow";

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
  /** TV list status: watching | completed | on_hold | dropped | plan_to_watch */
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
    const { data: viewerData } = await supabase.auth.getUser();
    const viewerId = viewerData?.user?.id ?? null;

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

    // 1. Aggregate show IDs from all 4 sources
    const [listRes, watchedEpRes, watchLaterRes, watchedItemRes] =
      await Promise.all([
        supabase
          .from("user_tv_list")
          .select("show_id, status, updated_at")
          .eq("user_id", userId),
        supabase
          .from("watched_episodes")
          .select("show_id")
          .eq("user_id", userId),
        supabase
          .from("user_watchlist")
          .select("item_id")
          .eq("user_id", userId)
          .eq("item_type", "tv"),
        supabase
          .from("watched_items")
          .select("item_id")
          .eq("user_id", userId)
          .eq("item_type", "tv")
          .eq("is_watched", true),
      ]);

    const taggedData = listRes.data ?? [];
    const statusMap = new Map<string, string>();
    const timeMap = new Map<string, string>();
    for (const item of taggedData) {
      statusMap.set(String(item.show_id), item.status);
      timeMap.set(String(item.show_id), item.updated_at);
    }

    const allIds = new Set<string>();
    taggedData.forEach((r) => allIds.add(String(r.show_id)));
    (watchedEpRes.data ?? []).forEach((r) => allIds.add(String(r.show_id)));
    (watchLaterRes.data ?? []).forEach((r) => allIds.add(String(r.item_id)));
    (watchedItemRes.data ?? []).forEach((r) => allIds.add(String(r.item_id)));

    let filteredIds: string[] = [];

    if (statusFilter === "untagged") {
      // Only items that are NOT in user_tv_list
      filteredIds = Array.from(allIds).filter((id) => !statusMap.has(id));
    } else if (statusFilter) {
      // Filter by specific status
      filteredIds = Array.from(allIds).filter(
        (id) => statusMap.get(id) === statusFilter,
      );
    } else {
      // All items
      filteredIds = Array.from(allIds);
    }

    // Sort: Tagged items by updated_at (desc), others at end
    filteredIds.sort((a, b) => {
      const timeA = timeMap.get(a) || "0";
      const timeB = timeMap.get(b) || "0";
      return timeB.localeCompare(timeA);
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
            supabase
              .from("watched_episodes")
              .select("season_number, episode_number")
              .eq("user_id", userId)
              .eq("show_id", showId),
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
          const episodesWatched = watchedSet.size;
          const name = (showData?.name as string) ?? "Unknown Show";
          const poster = (showData?.poster_path as string) ?? null;

          const seasons = Array.isArray(showData?.seasons)
            ? showData.seasons
            : [];
          const seasonCounts = new Map<number, number>();
          const allEpisodes: { s: number; e: number }[] = [];

          for (const season of seasons) {
            const sn = Number((season as any).season_number);
            if (sn < 0 || Number.isNaN(sn)) continue;
            const count = Number((season as any).episode_count) || 0;
            seasonCounts.set(sn, count);
            for (let ep = 1; ep <= count; ep++) {
              allEpisodes.push({ s: sn, e: ep });
            }
          }

          allEpisodes.sort((a, b) => a.s - b.s || a.e - b.e);

          let seasonsCompleted = 0;
          for (const [sn, totalEp] of seasonCounts.entries()) {
            let w = 0;
            for (let ep = 1; ep <= totalEp; ep++) {
              if (watchedSet.has(`${sn},${ep}`)) w++;
            }
            if (totalEp > 0 && w >= totalEp) seasonsCompleted++;
          }

          const nextEp = allEpisodes.find(
            ({ s, e }) => !watchedSet.has(`${s},${e}`),
          );

          return {
            show_id: showId,
            show_name: name,
            poster_path: poster,
            seasons_completed: seasonsCompleted,
            episodes_watched: episodesWatched,
            total_episodes: allEpisodes.length,
            next_season: nextEp?.s ?? null,
            next_episode: nextEp?.e ?? null,
            all_complete: !nextEp,
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
