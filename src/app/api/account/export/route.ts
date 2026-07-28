import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const [profileRes, watchedRes, ratingsRes, reviewsRes, listsRes, favoritesRes, statusRes, followersRes, followingRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", userId).single(),
    supabase.from("watched_items").select("*").eq("user_id", userId).eq("is_watched", true).order("watched_at", { ascending: false }),
    supabase.from("user_ratings").select("*").eq("user_id", userId),
    supabase.from("watched_items").select("item_id, item_name, item_type, review_text, public_review_text, watched_at").eq("user_id", userId).not("review_text", "is", null),
    supabase.from("user_lists").select("*, items:user_list_items(*)").eq("user_id", userId),
    supabase.from("favorite_items").select("*").eq("user_id", userId),
    supabase.from("user_media_status").select("*").eq("user_id", userId),
    supabase.from("user_connections").select("follower_id").eq("followed_id", userId),
    supabase.from("user_connections").select("followed_id").eq("follower_id", userId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: profileRes.data ?? null,
    watched: watchedRes.data ?? [],
    favorites: favoritesRes.data ?? [],
    ratings: ratingsRes.data ?? [],
    reviews: reviewsRes.data ?? [],
    lists: listsRes.data ?? [],
    media_status: statusRes.data ?? [],
    followers: (followersRes.data ?? []).map((c: any) => c.follower_id),
    following: (followingRes.data ?? []).map((c: any) => c.followed_id),
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="letsee-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
