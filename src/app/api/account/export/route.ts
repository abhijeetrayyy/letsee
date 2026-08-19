import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  // Migration 072 took `email` out of the column grant for anon/authenticated,
  // because RLS filters rows and not columns and `users_select_public` was
  // handing the whole table to the anon key. A `select("*")` here would now
  // fail with 42501 for every caller, so the columns are named — and the
  // address itself comes from the auth schema, which has always owned it.
  const { data: authUser } = await supabase.auth.getUser();

  const [profileRes, watchedRes, ratingsRes, reviewsRes, listsRes, favoritesRes, statusRes, followersRes, followingRes] = await Promise.all([
    supabase
      .from("users")
      // One literal, not a concatenation: supabase-js infers the row type from
      // the select string, and only a string *literal* carries that type.
      .select("id, username, about, visibility, watch_region, avatar_url, banner_url, tagline, featured_list_id, pinned_review_id, profile_show_diary, profile_show_ratings, profile_show_public_reviews, deleted_at, deletion_scheduled_at, created_at, updated_at")
      .eq("id", userId)
      .single(),
    // Not `select("*")`: migration 076 revoked SELECT on `review_text`, so a
    // star select answers 42501. The diary comes back through my_diary_notes()
    // below, which is SECURITY DEFINER and scoped to auth.uid().
    supabase.from("watched_items").select("id, user_id, item_id, item_name, item_type, image_url, item_adult, genres, watched_at, is_watched, public_review_text").eq("user_id", userId).eq("is_watched", true).order("watched_at", { ascending: false }),
    supabase.from("user_ratings").select("*").eq("user_id", userId),
    supabase.rpc("my_diary_notes"),
    supabase.from("user_lists").select("*, items:user_list_items(*)").eq("user_id", userId),
    supabase.from("favorite_items").select("*").eq("user_id", userId),
    supabase.from("user_media_status").select("*").eq("user_id", userId),
    supabase.from("user_connections").select("follower_id").eq("followed_id", userId),
    supabase.from("user_connections").select("followed_id").eq("follower_id", userId),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: profileRes.data
      ? { ...profileRes.data, email: authUser?.user?.email ?? null }
      : null,
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
