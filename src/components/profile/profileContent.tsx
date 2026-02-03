import { createClient } from "@/utils/supabase/server";
import React from "react";
import ProfileFavorite from "./ProfileFavorite";
import ProfileWatchlater from "./ProfileWatchlater";
import ProfileWatched from "./profileWatched";
import RecommendationTile from "./recomendation";

const getUserData = async (id: any) => {
  const supabase = await createClient();

  const { count: watchedCount, error: countError } = await supabase
    .from("watched_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id)
    .eq("is_watched", true);

  const { data: watchlist, error: watchlistError } = await supabase
    .from("user_watchlist")
    .select()
    .eq("user_id", id)
    .order("id", { ascending: false });
  const { count: watchlistCount, error: watchlistCountError } = await supabase
    .from("user_watchlist")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id);
  const { count: favoriteCount, error: favoriteCountError } = await supabase
    .from("favorite_items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id);
  const { data: favorates, error: favoritesError } = await supabase
    .from("favorite_items")
    .select()
    .eq("user_id", id)
    .order("id", { ascending: false });

  if (
    countError ||
    watchlistError ||
    watchlistCountError ||
    favoriteCountError ||
    favoritesError
  ) {
    console.error("Profile content fetch error:", {
      countError,
      watchlistError,
      watchlistCountError,
      favoriteCountError,
      favoritesError,
    });
    return {
      watchlistCount: 0,
      watchedCount: 0,
      favoriteCount: 0,
      favorates: [],
      watchlist: [],
    };
  }

  return {
    watchlistCount: watchlistCount ?? 0,
    watchedCount: watchedCount ?? 0,
    favoriteCount: favoriteCount ?? 0,
    favorates: favorates ?? [],
    watchlist: watchlist ?? [],
  };
};

async function profileContent({ profileId, isOwner = false }: { profileId: string; isOwner?: boolean }) {
  const {
    watchlistCount,
    watchedCount,
    favoriteCount,
    favorates,
    watchlist,
  }: any = await getUserData(profileId);

  return (
    <div>
      {favoriteCount > 0 && (
        <ProfileFavorite favorites={favorates} favoriteCount={favoriteCount} />
      )}
      {watchlistCount > 0 && (
        <ProfileWatchlater
          watchlist={watchlist}
          watchlistCount={watchlistCount}
        />
      )}
      {watchedCount > 0 && (
        <div className="">
          <div className="my-3">
            <h1 className="text-2xl font-bold mb-4">
              Watched &quot;{watchedCount}&quot;
            </h1>
          </div>
          <ProfileWatched userId={profileId} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}

export default profileContent;
