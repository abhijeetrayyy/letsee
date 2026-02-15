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
    { data: movieWatching, error: movieWatchingError },
    { data: tvWatching, error: tvWatchingError },
  ] = await Promise.all([
    supabase.from("favorite_items").select("item_id").eq("user_id", userId),
    supabase
      .from("watched_items")
      .select("item_id")
      .eq("user_id", userId)
      .eq("is_watched", true),
    supabase.from("user_watchlist").select("item_id").eq("user_id", userId),
    // Movies: from currently_watching
    supabase.from("currently_watching").select("item_id").eq("user_id", userId),
    // TV: from user_tv_list with 'watching' status
    supabase
      .from("user_tv_list")
      .select("show_id")
      .eq("user_id", userId)
      .eq("status", "watching"),
  ]);

  if (
    userFavoritesError ||
    userWatchedError ||
    userWatchlistError ||
    movieWatchingError ||
    tvWatchingError
  ) {
    return jsonError("Failed to fetch user preferences.", 500);
  }

  // Merge movie watching (item_id) + tv watching (show_id as item_id) into one list
  const watching = [
    ...(movieWatching ?? []),
    ...(tvWatching ?? []).map((r) => ({ item_id: r.show_id })),
  ];

  return jsonSuccess(
    {
      favorite: userFavorites ?? [],
      watched: userWatched ?? [],
      watchlater: userWatchlist ?? [],
      watching,
    },
    { maxAge: 0 },
  );
};
