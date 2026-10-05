import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { fetchAllRows } from "@/utils/fetchAllRows";

import { guard } from "@/lib/limits/guard";
export async function GET(req: NextRequest) {
  const limited = await guard("heavy", req);
  if (limited) return limited;
  const supabase = await createClient();
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError("User isn't logged in", 401);
  }

  const showId = req.nextUrl.searchParams.get("showId")?.trim();
  if (!showId) {
    return jsonError("showId query parameter is required", 400);
  }

  // Every row, past PostgREST's 1,000-row default: a long-running show can
  // have more, and a missing row turns a check into an unmark.
  const { rows, error } = await fetchAllRows<{ season_number: number; episode_number: number; watched_at: string }>((from, to) =>
    supabase
      .from("watched_episodes")
      .select("season_number, episode_number, watched_at")
      .eq("user_id", userId)
      .eq("show_id", showId)
      .order("season_number", { ascending: true })
      .order("episode_number", { ascending: true })
      .range(from, to),
  );

  if (error) {
    console.error("watched-episodes get:", error);
    return jsonError("Failed to fetch watched episodes", 500);
  }

  const episodes = (rows ?? []).map((r) => ({
    season_number: r.season_number,
    episode_number: r.episode_number,
    watched_at: r.watched_at,
  }));
  return jsonSuccess({ episodes }, { maxAge: 0 });
}
