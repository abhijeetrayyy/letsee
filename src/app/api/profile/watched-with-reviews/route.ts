import { createClient } from "@/utils/supabase/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

/** GET /api/profile/watched-with-reviews — returns watched items that have review_text (for current user, for pinned review dropdown) */
export async function GET() {
  const supabase = await createClient();
  const { data: user, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.user) {
    return jsonError("Not logged in", 401);
  }

  const { data, error } = await supabase
    .from("watched_items")
    .select("id, item_id, item_type, item_name")
    .eq("user_id", user.user.id)
    .not("review_text", "is", null)
    .order("watched_at", { ascending: false })
    .limit(50);

  if (error) {
    return jsonError(error.message || "Failed to fetch", 500);
  }

  return jsonSuccess(
    { items: data ?? [] },
    { maxAge: 0 }
  );
}
