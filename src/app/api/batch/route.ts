import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BatchItem = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName?: string;
  imageUrl?: string | null;
  genres?: string[];
  itemAdult?: boolean;
};

type BatchEpisode = {
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, items, episodes } = body;

    switch (action) {
      case "mark-watched": {
        if (!Array.isArray(items) || items.length === 0) {
          return NextResponse.json({ error: "items array required" }, { status: 400 });
        }
        const toInsert = items.map((item: BatchItem) => ({
          user_id: userId,
          item_id: item.itemId,
          item_name: item.itemName ?? item.itemId,
          item_type: item.itemType,
          image_url: item.imageUrl ?? null,
          item_adult: item.itemAdult ?? false,
          genres: item.genres ?? [],
          is_watched: true,
          watched_at: new Date().toISOString(),
        }));
        const { data, error } = await supabase.from("watched_items").upsert(toInsert, {
          onConflict: "user_id, item_id",
          ignoreDuplicates: false,
        }).select("item_id");
        if (error) throw error;
        return NextResponse.json({ success: true, count: data?.length ?? 0 });
      }

      case "add-watchlist": {
        if (!Array.isArray(items) || items.length === 0) {
          return NextResponse.json({ error: "items array required" }, { status: 400 });
        }
        const toInsert = items.map((item: BatchItem) => ({
          user_id: userId,
          item_id: item.itemId,
          item_name: item.itemName ?? item.itemId,
          item_type: item.itemType,
          image_url: item.imageUrl ?? null,
          item_adult: item.itemAdult ?? false,
          genres: item.genres ?? [],
        }));
        const { data, error } = await supabase.from("user_watchlist").upsert(toInsert, {
          onConflict: "user_id, item_id",
          ignoreDuplicates: true,
        }).select("item_id");
        if (error) throw error;

        await supabase.rpc("increment_watchlist_count", { p_user_id: userId });
        return NextResponse.json({ success: true, count: data?.length ?? 0 });
      }

      case "mark-episodes": {
        if (!Array.isArray(episodes) || episodes.length === 0) {
          return NextResponse.json({ error: "episodes array required" }, { status: 400 });
        }
        const toInsert = episodes.map((ep: BatchEpisode) => ({
          user_id: userId,
          show_id: ep.showId,
          season_number: ep.seasonNumber,
          episode_number: ep.episodeNumber,
          watched_at: new Date().toISOString(),
        }));
        const { data, error } = await supabase.from("watched_episodes").upsert(toInsert, {
          onConflict: "user_id, show_id, season_number, episode_number",
          ignoreDuplicates: true,
        }).select("id");
        if (error) throw error;
        return NextResponse.json({ success: true, count: data?.length ?? 0 });
      }

      case "remove-watchlist": {
        if (!Array.isArray(items) || items.length === 0) {
          return NextResponse.json({ error: "items array required" }, { status: 400 });
        }
        const ids = items.map((i: BatchItem) => i.itemId);
        const { error } = await supabase
          .from("user_watchlist")
          .delete()
          .eq("user_id", userId)
          .in("item_id", ids);
        if (error) throw error;
        return NextResponse.json({ success: true, count: ids.length });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("Batch operation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Batch operation failed" },
      { status: 500 },
    );
  }
}
