import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const itemId = body.itemId != null ? String(body.itemId) : null;
  const name = typeof body.name === "string" ? body.name : "";
  const mediaType = body.mediaType === "tv" ? "tv" : "movie";
  const imgUrl = typeof body.imgUrl === "string" ? body.imgUrl : null;
  const adult = body.adult === true;
  const genres = Array.isArray(body.genres) ? (body.genres as string[]) : [];

  if (!itemId || !name) {
    return jsonError("itemId and name are required", 400);
  }

  // Check if already favorited
  const { data: existing, error: findError } = await supabase
    .from("favorite_items")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    // Without the type this matched a film when the user meant the series
    // that happens to share its TMDB id, and maybeSingle() would throw once
    // both existed.
    .eq("item_type", mediaType)
    .maybeSingle();

  if (findError) return jsonError("Failed to check favorite status", 500);

  // If already favorited, remove it (toggle off)
  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorite_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", mediaType);

    if (deleteError) return jsonError(deleteError.message, 500);

    try {
      await supabase.rpc("decrement_favorites_count", { p_user_id: userId });
    } catch {}

    return jsonSuccess({ action: "removed", message: "Removed from favorites" });
  }

  // Add to favorites
  const { error: insertError } = await supabase.from("favorite_items").insert({
    user_id: userId,
    item_name: name,
    item_id: itemId,
    item_type: mediaType,
    image_url: imgUrl,
    item_adult: adult,
    genres,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonSuccess({ message: "Already favorited" });
    }
    return jsonError(insertError.message, 500);
  }

  try {
    await supabase.rpc("increment_favorites_count", { p_user_id: userId });
  } catch {}

  return jsonSuccess({ action: "added", message: "Added to favorites" });
}
