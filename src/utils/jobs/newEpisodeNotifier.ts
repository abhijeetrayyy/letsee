/**
 * Daily: tell people when a show they're watching has a new episode.
 *
 * ── Why this isn't on the job queue ─────────────────────────────────────────
 * `background_jobs` (024) looks like the right home and isn't: nothing calls
 * registerJobHandler, so dispatchJob always fails with "No handler registered",
 * and vercel.json declared no crons, so the runner was never invoked either.
 * `checkWatchlistAvailability` sidesteps all of that by being a plain function
 * a cron route calls directly, and that pattern demonstrably works — so this
 * follows it rather than reviving a queue nobody has ever run a job through.
 *
 * ── On not being annoying ───────────────────────────────────────────────────
 * `notified_episodes` records every announcement. Without it each daily run
 * re-notifies every show with a recent episode, and a notification people
 * learn to ignore is worse than one that was never built.
 */

import { createAdminClient } from "@/utils/supabase/server";
import { fetchTmdbJson } from "@/utils/tmdbClient";

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Only announce episodes that aired recently — not a back catalogue dump. */
const RECENT_DAYS = 8;
/** Shows examined per run, newest activity first. Keeps inside the time limit. */
const MAX_SHOWS = 120;

type ShowDetail = {
  name?: string;
  poster_path?: string | null;
  last_episode_to_air?: {
    season_number?: number;
    episode_number?: number;
    name?: string;
    air_date?: string;
  } | null;
};

export type NotifyResult = { showsChecked: number; notificationsSent: number };

function airedRecently(airDate: string | undefined): boolean {
  if (!airDate) return false;
  const aired = new Date(`${airDate}T00:00:00Z`).getTime();
  if (Number.isNaN(aired)) return false;
  const age = Date.now() - aired;
  return age >= 0 && age <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

export async function notifyNewEpisodes(): Promise<NotifyResult> {
  if (!process.env.TMDB_API_KEY) return { showsChecked: 0, notificationsSent: 0 };

  const supabase = createAdminClient();

  // Everyone currently watching something, and what.
  const { data: watching, error } = await supabase
    .from("user_media_status")
    .select("user_id, item_id, item_name")
    .eq("item_type", "tv")
    .eq("status", "watching")
    .order("updated_at", { ascending: false });

  if (error || !watching || watching.length === 0) {
    if (error) console.error("[newEpisodes] load watching:", error);
    return { showsChecked: 0, notificationsSent: 0 };
  }

  // One TMDB lookup per distinct show, however many people are watching it.
  const watchersByShow = new Map<string, string[]>();
  for (const row of watching) {
    const showId = String(row.item_id);
    const list = watchersByShow.get(showId) ?? [];
    list.push(row.user_id as string);
    watchersByShow.set(showId, list);
  }

  const showIds = [...watchersByShow.keys()].slice(0, MAX_SHOWS);
  let notificationsSent = 0;

  for (const showId of showIds) {
    let detail: ShowDetail;
    try {
      detail = await fetchTmdbJson<ShowDetail>(
        `${TMDB_BASE}/tv/${showId}?api_key=${process.env.TMDB_API_KEY}`,
        { timeoutMs: 8000 },
      );
    } catch {
      continue;
    }

    const last = detail.last_episode_to_air;
    if (!last || !airedRecently(last.air_date)) continue;

    const season = Number(last.season_number);
    const episode = Number(last.episode_number);
    if (!Number.isInteger(season) || !Number.isInteger(episode)) continue;

    const watchers = watchersByShow.get(showId) ?? [];
    if (watchers.length === 0) continue;

    // Who already knows — either we told them, or they've already watched it.
    const [{ data: alreadyTold }, { data: alreadySeen }] = await Promise.all([
      supabase
        .from("notified_episodes")
        .select("user_id")
        .eq("show_id", showId)
        .eq("season_number", season)
        .eq("episode_number", episode)
        .in("user_id", watchers),
      supabase
        .from("watched_episodes")
        .select("user_id")
        .eq("show_id", showId)
        .eq("season_number", season)
        .eq("episode_number", episode)
        .in("user_id", watchers),
    ]);

    const skip = new Set<string>([
      ...(alreadyTold ?? []).map((r) => r.user_id as string),
      ...(alreadySeen ?? []).map((r) => r.user_id as string),
    ]);

    const targets = watchers.filter((id) => !skip.has(id));
    if (targets.length === 0) continue;

    const showName = detail.name ?? "a show you're watching";
    const episodeLabel = `S${season}E${episode}`;

    const { error: notifyError } = await supabase.from("notifications").insert(
      targets.map((userId) => ({
        user_id: userId,
        notification_type: "new_episode",
        // No actor: this isn't something a person did. The notifications page
        // falls back to metadata for the text.
        actor_id: null,
        target_type: "tv",
        target_id: showId,
        metadata: {
          show_id: showId,
          show_name: showName,
          season_number: season,
          episode_number: episode,
          episode_name: last.name ?? episodeLabel,
          poster_path: detail.poster_path ?? null,
        },
      })),
    );

    if (notifyError) {
      console.error(`[newEpisodes] notify ${showId}:`, notifyError);
      continue;
    }

    // Only record the announcement once it actually went out, so a failed
    // insert is retried tomorrow rather than silently swallowed forever.
    const { error: markError } = await supabase.from("notified_episodes").upsert(
      targets.map((userId) => ({
        user_id: userId,
        show_id: showId,
        season_number: season,
        episode_number: episode,
      })),
      { onConflict: "user_id,show_id,season_number,episode_number", ignoreDuplicates: true },
    );
    if (markError) console.error(`[newEpisodes] mark ${showId}:`, markError);

    notificationsSent += targets.length;
  }

  return { showsChecked: showIds.length, notificationsSent };
}
