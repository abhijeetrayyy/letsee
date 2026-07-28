import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { itemId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { itemId } = body;
  if (!itemId) return jsonError("itemId is required", 400);

  const { data: existingItem } = await supabase
    .from("favorite_items")
    .select("item_id")
    .eq("user_id", userId)
    .eq("item_id", String(itemId))
    .maybeSingle();

  if (!existingItem) return jsonSuccess({ message: "Not favorited" });

  const { error: deleteError } = await supabase
    .from("favorite_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", String(itemId));

  if (deleteError) return jsonError(deleteError.message, 500);

  try {
    await supabase.rpc("decrement_favorites_count", { p_user_id: userId });
  } catch {}

  return jsonSuccess({ message: "Removed from favorites" });
}
