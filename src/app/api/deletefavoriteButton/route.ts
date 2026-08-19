import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { itemId?: string; mediaType?: string; itemType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { itemId } = body;
  if (!itemId) return jsonError("itemId is required", 400);
  // A bare id names two possible titles, so without this it removed both the
  // film and the series that share it. Accepts either spelling the two
  // providers use.
  const itemType = (body.mediaType ?? body.itemType) === "tv" ? "tv" : "movie";

  const { data: existingItem } = await supabase
    .from("favorite_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_id", String(itemId))
    .eq("item_type", itemType)
    .maybeSingle();

  if (!existingItem) return jsonSuccess({ message: "Not favorited" });

  /**
   * The displayed four go first.
   *
   * This route is where every card un-favourite lands
   * (MediaInteractionProvider.tsx picks it whenever the title is already a
   * favourite), and it did not know `user_favorite_display` existed — so a
   * title removed from a card stayed in the four films on the profile, which is
   * exactly the state 068 and the sibling route were written to abolish. Order
   * matches /api/user-media-status: the display is what a stranger sees, so it
   * must never be the row that survives.
   */
  await supabase
    .from("user_favorite_display")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", String(itemId))
    .eq("item_type", itemType);

  const { error: deleteError } = await supabase
    .from("favorite_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", String(itemId))
    .eq("item_type", itemType);

  if (deleteError) return jsonError(deleteError.message, 500);

  // No decrement_favorites_count here. 069 put a statement-level trigger on
  // favorite_items that calls recount_user_stats, which writes an ABSOLUTE
  // count — so the delete above has already left the counter correct, and the
  // old relative `favorites_count - 1` on top of it took one more off. Verified
  // against the live database: cached favorites_count matches the row count
  // exactly for every user.

  return jsonSuccess({ message: "Removed from favorites" });
}
