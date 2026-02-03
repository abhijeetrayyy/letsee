import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const userId = userData.user.id;

  const showId = req.nextUrl.searchParams.get("showId")?.trim();
  if (!showId) {
    return jsonError("showId query parameter is required", 400);
  }

  const { data: rows, error } = await supabase
    .from("watched_episodes")
    .select("season_number, episode_number")
    .eq("user_id", userId)
    .eq("show_id", showId)
    .order("season_number", { ascending: true })
    .order("episode_number", { ascending: true });

  if (error) {
    console.error("watched-episodes get:", error);
    return jsonError("Failed to fetch watched episodes", 500);
  }

  const episodes = (rows ?? []).map((r) => ({
    season_number: r.season_number,
    episode_number: r.episode_number,
  }));
  return jsonSuccess({ episodes }, { maxAge: 0 });
}
