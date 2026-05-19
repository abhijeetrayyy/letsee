import { createClient } from "@/utils/supabase/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
const SECONDS_PER_EPISODE = 45 * 60;

type SeasonInfo = {
  season_number: number;
  episode_count: number;
};

type ShowInfo = {
  id: number;
  name: string;
  number_of_seasons: number;
  number_of_episodes: number;
  seasons: SeasonInfo[];
  status: string;
  poster_path?: string;
};

type ShowPrediction = {
  showId: string;
  showName: string;
  posterUrl: string | null;
  totalEpisodes: number;
  watchedEpisodes: number;
  remainingEpisodes: number;
  episodesPerDay: number;
  estimatedDaysRemaining: number;
  estimatedCompletionDate: string;
  estimatedHoursRemaining: number;
  showStatus: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY missing" }, { status: 500 });
  }

  try {
    const [tvListRes, watchedEpisodesRes] = await Promise.all([
      supabase.from("user_tv_list").select("show_id, status").eq("user_id", userId).eq("status", "watching"),
      supabase.from("watched_episodes").select("show_id, watched_at").eq("user_id", userId).order("watched_at", { ascending: true }),
    ]);

    const watchingShows = tvListRes.data ?? [];
    const watchedEpisodes = watchedEpisodesRes.data ?? [];

    if (watchingShows.length === 0) {
      return NextResponse.json({ predictions: [], note: "No TV shows in progress." });
    }

    // Group watched episodes by show
    const watchedByShow = new Map<string, { count: number; firstDate: Date | null; lastDate: Date | null }>();
    for (const ep of watchedEpisodes) {
      if (!watchedByShow.has(ep.show_id)) {
        watchedByShow.set(ep.show_id, { count: 0, firstDate: null, lastDate: null });
      }
      const entry = watchedByShow.get(ep.show_id)!;
      entry.count++;
      const date = new Date(ep.watched_at);
      if (!entry.firstDate || date < entry.firstDate) entry.firstDate = date;
      if (!entry.lastDate || date > entry.lastDate) entry.lastDate = date;
    }

    const predictions: ShowPrediction[] = [];

    for (const show of watchingShows) {
      try {
        const data = await serverFetchJson<ShowInfo>(
          `${TMDB_BASE}/tv/${show.show_id}?api_key=${apiKey}&language=en-US`,
          { retries: 1 },
        );

        const showWatched = watchedByShow.get(show.show_id);
        const watchedCount = showWatched?.count ?? 0;
        const totalEpisodes = data.number_of_episodes ?? 0;
        const remaining = Math.max(0, totalEpisodes - watchedCount);

        if (totalEpisodes === 0) continue;

        // Calculate watch velocity
        let episodesPerDay = 0;
        if (showWatched?.firstDate && showWatched?.lastDate) {
          const daysDiff = (showWatched.lastDate.getTime() - showWatched.firstDate.getTime()) / 86400000;
          if (daysDiff > 0) {
            episodesPerDay = watchedCount / daysDiff;
          }
        }

        // Fallback: assume 1 episode per day if no data
        if (episodesPerDay === 0) episodesPerDay = 1;

        const estimatedDays = Math.ceil(remaining / episodesPerDay);
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() + estimatedDays);

        const seasonsWithEpisodes = data.seasons?.filter((s) => s.season_number > 0) ?? [];
        const airedEpisodes = seasonsWithEpisodes.reduce((sum, s) => sum + s.episode_count, 0);

        predictions.push({
          showId: show.show_id,
          showName: data.name,
          posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w185${data.poster_path}` : null,
          totalEpisodes: Math.max(airedEpisodes, totalEpisodes),
          watchedEpisodes: watchedCount,
          remainingEpisodes: remaining,
          episodesPerDay: Math.round(episodesPerDay * 100) / 100,
          estimatedDaysRemaining: estimatedDays,
          estimatedCompletionDate: completionDate.toISOString().split("T")[0],
          estimatedHoursRemaining: Math.round(remaining * 0.75),
          showStatus: data.status ?? "Unknown",
        });
      } catch {
        // skip shows where TMDB data is unavailable
      }
    }

    predictions.sort((a, b) => a.estimatedDaysRemaining - b.estimatedDaysRemaining);

    return NextResponse.json({ predictions });
  } catch (err) {
    console.error("Completion predictor error:", err);
    return NextResponse.json({ error: "Failed to predict completion" }, { status: 500 });
  }
}
