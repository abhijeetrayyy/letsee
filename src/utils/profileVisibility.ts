import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileVisibilityResult =
  | { allowed: true }
  | { allowed: false; reason: "not_found" | "forbidden" };

/**
 * Shared visibility check for profile-scoped API routes: owner can always view,
 * "public" profiles are viewable by anyone, "followers" profiles require an
 * accepted user_connections row from the viewer.
 */
export async function canViewProfile(
  supabase: SupabaseClient,
  userId: string,
  viewerId: string | null,
): Promise<ProfileVisibilityResult> {
  const { data: profile, error } = await supabase
    .from("users")
    .select("visibility")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    return { allowed: false, reason: "not_found" };
  }

  if (viewerId === userId) return { allowed: true };

  const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
  if (visibility === "public") return { allowed: true };

  if (visibility === "followers" && viewerId) {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", userId)
      .maybeSingle();
    if (connection?.id) return { allowed: true };
  }

  return { allowed: false, reason: "forbidden" };
}
