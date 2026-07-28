import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

export const GET = async (_req: NextRequest) => {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const [
    { data: userFavorites, error: userFavoritesError },
    { data: userWatched, error: userWatchedError },
    { data: userWatchlist, error: userWatchlistError },
    { data: userWatching, error: userWatchingError },
  ] = await Promise.all([
    supabase.from("favorite_items").select("item_id").eq("user_id", userId),
    supabase.from("user_media_status").select("item_id").eq("user_id", userId).eq("status", "watched"),
    supabase.from("user_media_status").select("item_id").eq("user_id", userId).eq("status", "watchlist"),
    supabase.from("user_media_status").select("item_id").eq("user_id", userId).eq("status", "watching"),
  ]);

  if (userFavoritesError || userWatchedError || userWatchlistError || userWatchingError) {
    return jsonError("Failed to fetch user preferences.", 500);
  }

  return jsonSuccess(
    {
      favorite: userFavorites ?? [],
      watched: userWatched ?? [],
      watchlater: userWatchlist ?? [],
      watching: userWatching ?? [],
    },
    { maxAge: 0 }
  );
};
