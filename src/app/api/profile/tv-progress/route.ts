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
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 10, 1), 50);
  const offset = Math.max(Number(req.nextUrl.searchParams.get("offset")) || 0, 0);

  if (!userId) {
    return jsonError("userId query parameter is required", 400);
  }

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

  const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
  const canView =
    viewerId === userId ||
    visibility === "public" ||
    (visibility === "followers" &&
      viewerId &&
      (await supabase
        .from("user_connections")
        .select("id")
        .eq("follower_id", viewerId)
        .eq("followed_id", userId)
        .maybeSingle()).data?.id);

  if (!canView) {
    return jsonError("Forbidden", 403);
  }

  if (!process.env.TMDB_API_KEY) {
    return jsonError("TMDB API key is missing", 500);
  }

  const { data: showRows, error: showError } = await supabase
    .from("watched_episodes")
    .select("show_id, watched_at")
    .eq("user_id", userId)
    .order("watched_at", { ascending: false });

  if (showError) {
    console.error("profile/tv-progress shows:", showError);
    return jsonError("Failed to fetch progress", 500);
  }

  const showIdsByLastWatched = [...new Map((showRows ?? []).map((r) => [r.show_id, r.watched_at])).keys()];
  const total = showIdsByLastWatched.length;
  const slice = showIdsByLastWatched.slice(offset, offset + limit);
  if (slice.length === 0) {
    return jsonSuccess({ items: [], total }, { maxAge: 0 });
  }

  const items: ProfileTvProgressItem[] = [];

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
        if (watchedRes.error || !showData) return null;
        const watchedSet = new Set(
          (watchedRes.data ?? []).map((r) => `${r.season_number},${r.episode_number}`)
        );
        const episodesWatched = watchedSet.size;
        const name = (showData?.name as string) ?? "";
        const poster = showData?.poster_path ?? null;
        const seasons = Array.isArray(showData?.seasons) ? showData.seasons : [];
        const seasonCounts = new Map<number, number>();
        const allEpisodes: { s: number; e: number }[] = [];
        for (const season of seasons) {
          const sn = Number((season as { season_number?: number }).season_number);
          if (sn < 0 || Number.isNaN(sn)) continue;
          const count = Number((season as { episode_count?: number }).episode_count) || 0;
          seasonCounts.set(sn, count);
          for (let ep = 1; ep <= count; ep++) allEpisodes.push({ s: sn, e: ep });
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
        const nextEp = allEpisodes.find(({ s, e }) => !watchedSet.has(`${s},${e}`));
        return {
          show_id: showId,
          show_name: name,
          poster_path: poster,
          seasons_completed: seasonsCompleted,
          episodes_watched: episodesWatched,
          next_season: nextEp?.s ?? null,
          next_episode: nextEp?.e ?? null,
          all_complete: !nextEp,
        } as ProfileTvProgressItem;
      })
    );
    for (const item of batchResults) {
      if (item) items.push(item);
    }
    if (i + BATCH_SIZE < slice.length) await delay(BATCH_DELAY_MS);
  }

  return jsonSuccess({ items, total }, { maxAge: 0 });
}
