/**
 * The viewer's own profile row and its two follow counts.
 *
 * `/api/profile/settings` GET is three queries against tables the viewer owns
 * or can read publicly, behind a function whose only added value was reading
 * the cookie. The settings panel and the home sidebar both call it.
 *
 * The PATCH half moves here too: `users_self` allows the update, and the
 * whitelist below is what stops a settings form from writing a column it was
 * not offering — the same list the route enforced, now enforced before the
 * request rather than inside it.
 */

import { supabase } from "@/utils/supabase/client";

export type ProfileSettings = {
  visibility: string;
  profile_show_diary: boolean;
  profile_show_ratings: boolean;
  profile_show_public_reviews: boolean;
  avatar_url: string | null;
  tagline: string | null;
  followers_count: number;
  following_count: number;
};

export async function fetchProfileSettings(userId: string): Promise<ProfileSettings | null> {
  const [{ data, error }, followers, following] = await Promise.all([
    supabase
      .from("users")
      .select(
        "visibility, profile_show_diary, profile_show_ratings, profile_show_public_reviews, avatar_url, tagline",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_connections")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", userId),
    supabase
      .from("user_connections")
      .select("followed_id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  if (error) throw error;
  if (!data) return null;

  return {
    visibility: data.visibility ?? "public",
    profile_show_diary: data.profile_show_diary ?? true,
    profile_show_ratings: data.profile_show_ratings ?? true,
    profile_show_public_reviews: data.profile_show_public_reviews ?? true,
    avatar_url: data.avatar_url ?? null,
    tagline: data.tagline ?? null,
    followers_count: followers.count ?? 0,
    following_count: following.count ?? 0,
  };
}

const VISIBILITIES = ["public", "followers", "private"];

export type ProfileSettingsPatch = {
  visibility?: string;
  profile_show_diary?: boolean;
  profile_show_ratings?: boolean;
  profile_show_public_reviews?: boolean;
};

/** Update the viewer's own settings. Returns an error message, or null. */
export async function updateProfileSettings(
  userId: string,
  patch: ProfileSettingsPatch,
): Promise<string | null> {
  const updates: Record<string, unknown> = {};
  if (typeof patch.visibility === "string" && VISIBILITIES.includes(patch.visibility)) {
    updates.visibility = patch.visibility;
  }
  for (const key of [
    "profile_show_diary",
    "profile_show_ratings",
    "profile_show_public_reviews",
  ] as const) {
    if (typeof patch[key] === "boolean") updates[key] = patch[key];
  }

  if (Object.keys(updates).length === 0) return "Nothing to update.";

  const { error } = await supabase.from("users").update(updates).eq("id", userId);
  return error ? error.message : null;
}
