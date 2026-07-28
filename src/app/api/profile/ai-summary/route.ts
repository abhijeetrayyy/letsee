import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { computeTasteSummary } from "@/utils/tasteProfile";

export async function GET(req: NextRequest) {
  const viewerId = await getAuthUserId();
  const url = new URL(req.url);
  const profileId = url.searchParams.get("userId");

  if (!profileId) return jsonError("userId is required", 400);

  const supabase = await createClient();

  // Check visibility
  const { data: profile } = await supabase
    .from("users")
    .select("id, username, visibility")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return jsonError("Profile not found", 404);

  const isOwner = viewerId === profileId;
  let canView = profile.visibility === "public" || isOwner;

  if (!canView && viewerId && profile.visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", profileId)
      .maybeSingle();
    if (connection) canView = true;
  }

  if (!canView) return jsonError("Not available", 403);

  // Fetch data for taste summary
  const [{ data: watchedItems }, { data: ratings }] = await Promise.all([
    supabase
      .from("watched_items")
      .select("item_id, item_type, genres")
      .eq("user_id", profileId)
      .eq("is_watched", true),
    supabase
      .from("user_ratings")
      .select("item_id, item_type, score")
      .eq("user_id", profileId),
  ]);

  if (!watchedItems?.length) {
    return jsonSuccess({
      summary: "No watched items yet to analyze.",
      topGenres: [],
      watchingStyle: "",
      recommendation: "",
    });
  }

  const tasteProfile = computeTasteSummary(watchedItems, ratings ?? []);

  const topGenreNames = tasteProfile.topGenres.slice(0, 4).map((g) => g.genre);
  const totalWatched = watchedItems.length;
  const avgRating = ratings?.length
    ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
    : null;

  // Build a natural language summary without external API calls
  let summary = "";
  let watchingStyle = "";

  if (topGenreNames.length >= 2) {
    summary = `${profile.username} loves ${topGenreNames[0]} and ${topGenreNames[1]}`;
  } else if (topGenreNames.length === 1) {
    summary = `${profile.username} is a ${topGenreNames[0]} fan`;
  } else {
    summary = `${profile.username} has an eclectic taste`;
  }

  if (totalWatched >= 100) {
    summary += ` with over ${totalWatched} titles watched`;
    watchingStyle = totalWatched >= 500 ? "A true cinephile" : "An active watcher";
  } else if (totalWatched >= 20) {
    summary += ` across ${totalWatched} titles`;
    watchingStyle = "Building their film journey";
  } else {
    summary += ` — just getting started`;
    watchingStyle = "Early explorer";
  }

  if (avgRating) {
    summary += `. Average rating: ${avgRating}/10`;
  }

  if (tasteProfile.totalGenresExplored >= 10) {
    summary += `. Explored ${tasteProfile.totalGenresExplored} genres`;
  }

  summary += ".";

  const recommendation = topGenreNames.length > 0
    ? `If you like their ${topGenreNames[0]} picks, check out what else they've watched.`
    : "";

  return jsonSuccess(
    {
      summary,
      topGenres: topGenreNames,
      watchingStyle,
      recommendation,
      totalWatched,
      avgRating: avgRating ? parseFloat(avgRating) : null,
    },
    { maxAge: 3600 }
  );
}
