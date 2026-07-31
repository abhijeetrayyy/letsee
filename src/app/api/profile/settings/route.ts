import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return jsonError("Unauthorized", 401);
  }
  const [{ data, error }, { count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from("users")
      .select("visibility, profile_show_diary, profile_show_ratings, profile_show_public_reviews, default_tv_status, avatar_url, tagline")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_connections").select("*", { count: "exact", head: true }).eq("followed_id", user.id),
    supabase.from("user_connections").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
  ]);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
  if (!data) {
    return jsonError("Profile not found", 404);
  }
  const d = data as { default_tv_status?: string } & typeof data;
  return new Response(
    JSON.stringify({
      visibility: data.visibility ?? "public",
      profile_show_diary: data.profile_show_diary ?? true,
      profile_show_ratings: data.profile_show_ratings ?? true,
      profile_show_public_reviews: data.profile_show_public_reviews ?? true,
      default_tv_status: ["watchlist", "watching", "watched", "on_hold", "dropped"].includes(d.default_tv_status ?? "")
        ? d.default_tv_status
        : "watching",
      avatar_url: data.avatar_url ?? null,
      tagline: data.tagline ?? null,
      followers_count: followersCount ?? 0,
      following_count: followingCount ?? 0,
    })
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return jsonError("Unauthorized", 401);
  }
  let body: {
    visibility?: string;
    profile_show_diary?: boolean;
    profile_show_ratings?: boolean;
    profile_show_public_reviews?: boolean;
    default_tv_status?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }
  const updates: Record<string, unknown> = {};
  if (typeof body.visibility === "string" && ["public", "followers", "private"].includes(body.visibility)) {
    updates.visibility = body.visibility;
  }
  if (typeof body.profile_show_diary === "boolean") updates.profile_show_diary = body.profile_show_diary;
  if (typeof body.profile_show_ratings === "boolean") updates.profile_show_ratings = body.profile_show_ratings;
  if (typeof body.profile_show_public_reviews === "boolean") updates.profile_show_public_reviews = body.profile_show_public_reviews;
  if (typeof body.default_tv_status === "string" && ["watchlist", "watching", "watched", "on_hold", "dropped"].includes(body.default_tv_status)) {
    updates.default_tv_status = body.default_tv_status;
  }
  if (Object.keys(updates).length === 0) {
    return jsonError("No valid fields to update", 400);
  }
  const { error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id);
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
