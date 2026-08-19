import { createClient } from "@/utils/supabase/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

/** GET /api/profile/watched-with-reviews — returns watched items that have review_text (for current user, for pinned review dropdown) */
export async function GET() {
  const supabase = await createClient();
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError("Not logged in", 401);
  }

  // Migration 076 revoked SELECT on `review_text` from anon/authenticated,
  // and a WHERE needs the privilege just as much as a SELECT list does — the
  // old `.not("review_text", "is", null)` would now answer 42501 even though
  // it never returned the column. my_diary_notes() is SECURITY DEFINER, scoped
  // to auth.uid(), and already filters to rows that have a note and orders them
  // newest-first, which is exactly this query.
  const { data, error } = await supabase.rpc("my_diary_notes", {
    p_item_ids: null,
    p_limit: 50,
  });

  if (error) {
    return jsonError(error.message || "Failed to fetch", 500);
  }

  type Note = { id: number; item_id: string; item_type: string; item_name: string };
  const items = ((data ?? []) as Note[]).map((r) => ({
    id: r.id,
    item_id: r.item_id,
    item_type: r.item_type,
    item_name: r.item_name,
  }));

  return jsonSuccess({ items }, { maxAge: 0 });
}
