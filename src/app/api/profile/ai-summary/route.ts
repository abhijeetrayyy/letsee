import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { computeTasteSummary, buildTasteInsight } from "@/utils/tasteProfile";

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

  const totalWatched = watchedItems?.length ?? 0;
  const tasteProfile = computeTasteSummary(watchedItems ?? [], ratings ?? []);
  const avgRating = ratings?.length
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : null;

  const insight = buildTasteInsight(profile.username, tasteProfile, totalWatched, avgRating);

  return jsonSuccess(insight, { maxAge: 3600 });
}
