import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";

export const GET = async (_req: NextRequest) => {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  // status is ONE column with five possible values, not three independent
  // flags. Fetch it once and derive the legacy buckets from it, so on_hold and
  // dropped stop being invisible to the client.
  const [
    { data: userFavorites, error: userFavoritesError },
    { data: statusRows, error: statusError },
  ] = await Promise.all([
    supabase.from("favorite_items").select("item_id").eq("user_id", userId),
    supabase.from("user_media_status").select("item_id, status").eq("user_id", userId),
  ]);

  if (userFavoritesError || statusError) {
    console.error("userPrefrence fetch error:", { userFavoritesError, statusError });
    return jsonError("Failed to fetch user preferences.", 500);
  }

  const statuses: Record<string, string> = {};
  const bucket = (name: string) =>
    (statusRows ?? []).filter((r) => r.status === name).map((r) => ({ item_id: r.item_id }));

  for (const row of statusRows ?? []) {
    statuses[String(row.item_id)] = String(row.status);
  }

  return jsonSuccess(
    {
      favorite: userFavorites ?? [],
      watched: bucket("watched"),
      watchlater: bucket("watchlist"),
      watching: bucket("watching"),
      statuses,
    },
    { maxAge: 0 }
  );
};
