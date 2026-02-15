import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  let userId = req.nextUrl.searchParams.get("userId")?.trim();
  const animeFlag = req.nextUrl.searchParams.get("anime") === "1";
  const itemTypeFilter = req.nextUrl.searchParams.get("itemType")?.trim(); // "tv" | "movie"

  if (!userId) {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return jsonError("User isn't logged in", 401);
    }
    userId = userData.user.id;
  }

  // Fetch TV shows from user_tv_list (status = watching) joined with watched_items for metadata
  const tvPromise = (async () => {
    // Skip TV if only movies requested
    if (itemTypeFilter === "movie") return [];

    const { data: tvListRows, error: tvListError } = await supabase
      .from("user_tv_list")
      .select("show_id, status, updated_at")
      .eq("user_id", userId)
      .eq("status", "watching")
      .order("updated_at", { ascending: false });

    if (tvListError || !tvListRows?.length) return [];

    const showIds = tvListRows.map((r) => r.show_id);

    const { data: metaRows } = await supabase
      .from("watched_items")
      .select("item_id, item_name, image_url, item_adult, genres")
      .eq("user_id", userId)
      .in("item_id", showIds);

    const metaMap = new Map((metaRows ?? []).map((r) => [r.item_id, r]));

    return tvListRows
      .map((row) => {
        const meta = metaMap.get(row.show_id);
        return {
          item_id: row.show_id,
          item_name: meta?.item_name ?? `Show ${row.show_id}`,
          item_type: "tv" as const,
          image_url: meta?.image_url ?? null,
          started_at: row.updated_at,
          item_adult: meta?.item_adult ?? false,
          genres: meta?.genres ?? [],
        };
      })
      .filter((item) => {
        if (animeFlag) {
          return (item.genres as string[]).some(
            (g) => g.toLowerCase() === "animation",
          );
        }
        return true;
      });
  })();

  // Fetch movies from currently_watching (unchanged)
  const moviePromise = (async () => {
    // Skip movies if only TV requested
    if (itemTypeFilter === "tv") return [];

    let query = supabase
      .from("currently_watching")
      .select(
        "item_id, item_name, item_type, image_url, started_at, item_adult, genres",
      )
      .eq("user_id", userId)
      .eq("item_type", "movie")
      .order("started_at", { ascending: false });

    if (animeFlag) {
      query = query.contains("genres", ["Animation"]);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data ?? []).map((r) => ({
      item_id: r.item_id,
      item_name: r.item_name,
      item_type: r.item_type,
      image_url: r.image_url,
      started_at: r.started_at,
      item_adult: r.item_adult ?? false,
      genres: r.genres ?? [],
    }));
  })();

  const [tvItems, movieItems] = await Promise.all([tvPromise, moviePromise]);
  const items = [...tvItems, ...movieItems];

  return jsonSuccess({ items }, { maxAge: 0 });
}
