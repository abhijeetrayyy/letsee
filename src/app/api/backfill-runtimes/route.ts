import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { fetchTmdb } from "@/utils/tmdbClient";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BATCH = 40;

/**
 * POST /api/backfill-runtimes
 *
 * Fills user_media_status.runtime_minutes for the caller's own titles.
 *
 * Hours used to assume 45 minutes an episode, which is roughly right for
 * prestige drama and roughly quadruple for the cartoons people actually
 * accumulate episodes on — Ben 10 runs 11 minutes. Storing the real figure per
 * title is the only way the total means anything.
 *
 * Runs in batches so one call can't hang on hundreds of TMDB round trips; call
 * it until `remaining` reaches 0.
 */
export async function POST(_req: NextRequest) {
  if (!TMDB_API_KEY) return jsonError("TMDB_API_KEY missing", 500);

  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const { data: pending, error } = await supabase
    .from("user_media_status")
    .select("item_id, item_type")
    .eq("user_id", userId)
    .is("runtime_minutes", null)
    .limit(BATCH);

  if (error) return jsonError(error.message, 500);
  if (!pending || pending.length === 0) {
    await supabase.rpc("recount_user_stats", { p_user_id: userId });
    return jsonSuccess({ done: true, updated: 0, remaining: 0 });
  }

  let updated = 0;
  for (const row of pending) {
    const runtime = await lookupRuntime(String(row.item_id), row.item_type);
    // Write 0 rather than leaving null when TMDB has nothing, so the row isn't
    // retried forever; the stats function treats 0 as unknown via nullif.
    const { error: upErr } = await supabase
      .from("user_media_status")
      .update({ runtime_minutes: runtime ?? 0 })
      .eq("user_id", userId)
      .eq("item_id", row.item_id);
    if (!upErr && runtime != null) updated += 1;
  }

  const { count: remaining } = await supabase
    .from("user_media_status")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("runtime_minutes", null);

  await supabase.rpc("recount_user_stats", { p_user_id: userId });

  return jsonSuccess({
    done: (remaining ?? 0) === 0,
    updated,
    remaining: remaining ?? 0,
  });
}

/** Movie: its runtime. TV: a representative episode length. */
async function lookupRuntime(itemId: string, itemType: string): Promise<number | null> {
  try {
    const res = await fetchTmdb(
      `https://api.themoviedb.org/3/${itemType === "tv" ? "tv" : "movie"}/${itemId}?api_key=${TMDB_API_KEY}`,
    );
    if (!res.ok) return null;
    const data = await res.json();

    if (itemType !== "tv") {
      return Number(data?.runtime) > 0 ? Number(data.runtime) : null;
    }

    // episode_run_time is often empty on long-running shows, so fall back to a
    // real episode's runtime before giving up.
    const listed = Array.isArray(data?.episode_run_time) ? data.episode_run_time : [];
    const first = listed.find((n: unknown) => Number(n) > 0);
    if (first) return Number(first);

    const lastAired = Number(data?.last_episode_to_air?.runtime);
    if (lastAired > 0) return lastAired;

    return null;
  } catch {
    return null;
  }
}
