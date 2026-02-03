import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

export const GET = async (_req: NextRequest) => {
  const supabase = await createClient();
  const { data: user, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.user) {
    return jsonError("User isn't logged in", 401);
  }

  const userId = user.user.id;

  const [
    { data: userFavorites, error: userFavoritesError },
    { data: userWatched, error: userWatchedError },
    { data: userWatchlist, error: userWatchlistError },
  ] = await Promise.all([
    supabase.from("favorite_items").select("item_id").eq("user_id", userId),
    supabase.from("watched_items").select("item_id").eq("user_id", userId).eq("is_watched", true),
    supabase.from("user_watchlist").select("item_id").eq("user_id", userId),
  ]);

  if (userFavoritesError || userWatchedError || userWatchlistError) {
    return jsonError("Failed to fetch user preferences.", 500);
  }

  return jsonSuccess(
    {
      favorite: userFavorites ?? [],
      watched: userWatched ?? [],
      watchlater: userWatchlist ?? [],
    },
    { maxAge: 0 }
  );
};
