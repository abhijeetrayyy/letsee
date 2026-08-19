import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { ensureShowInMediaStatus, autoTransitionStatus } from "@/utils/tvMediaStatus";

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
  const userId = await getAuthUserId();

  if (!userId) {
    return jsonError("Not authenticated", 401);
  }

  try {
    const body = await request.json();
    const { action, items, episodes } = body;

    switch (action) {
      case "mark-watched": {
        if (!Array.isArray(items) || items.length === 0) {
          return jsonError("items array required", 400);
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
          onConflict: "user_id,item_id,item_type",
          ignoreDuplicates: false,
        }).select("item_id");
        if (error) throw error;
        return NextResponse.json({ success: true, count: data?.length ?? 0 });
      }

      case "add-watchlist": {
        if (!Array.isArray(items) || items.length === 0) {
          return jsonError("items array required", 400);
        }
        const toInsert = items.map((item: BatchItem) => ({
          user_id: userId,
          item_id: item.itemId,
          item_name: item.itemName ?? item.itemId,
          item_type: item.itemType,
          image_url: item.imageUrl ?? null,
          item_adult: item.itemAdult ?? false,
          genres: item.genres ?? [],
          status: "watchlist",
          updated_at: new Date().toISOString(),
        }));
        const { data, error } = await supabase.from("user_media_status").upsert(toInsert, {
          onConflict: "user_id,item_id,item_type",
          ignoreDuplicates: true,
        }).select("item_id");
        if (error) throw error;

        await supabase.rpc("recount_user_stats", { p_user_id: userId });
        return NextResponse.json({ success: true, count: data?.length ?? 0 });
      }

      case "mark-episodes": {
        if (!Array.isArray(episodes) || episodes.length === 0) {
          return jsonError("episodes array required", 400);
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

        const showIds = [...new Set(episodes.map((ep: BatchEpisode) => ep.showId))];
        for (const showId of showIds) {
          await ensureShowInMediaStatus(supabase, userId, showId);
          await autoTransitionStatus(supabase, userId, showId);
        }
        return NextResponse.json({ success: true, count: data?.length ?? 0 });
      }

      case "remove-watchlist": {
        if (!Array.isArray(items) || items.length === 0) {
          return jsonError("items array required", 400);
        }
        const ids = items.map((i: BatchItem) => i.itemId);
        const { error } = await supabase
          .from("user_media_status")
          .delete()
          .eq("user_id", userId)
          .eq("status", "watchlist")
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
