import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, name, mediaType, imgUrl, adult, genres } = body;

    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data?.user) {
      return NextResponse.json(
        { error: "User isn't logged in" },
        { status: 401 },
      );
    }

    const userId = data.user.id;
    const itemIdStr = String(itemId);

    // Remove from watchlist if present (you're now watching it)
    const { data: existingWatchlistItem, error: watchlistFindError } =
      await supabase
        .from("user_watchlist")
        .select("item_id")
        .eq("user_id", userId)
        .eq("item_id", itemIdStr)
        .maybeSingle();

    if (watchlistFindError && watchlistFindError.code !== "PGRST116") {
      throw watchlistFindError;
    }

    if (existingWatchlistItem) {
      const { error: deleteWatchlistError } = await supabase
        .from("user_watchlist")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", itemIdStr);

      if (deleteWatchlistError) {
        console.error(
          "Error deleting item from watchlist:",
          deleteWatchlistError,
        );
        return NextResponse.json(
          { error: "Error removing from watchlist" },
          { status: 500 },
        );
      }

      await supabase.rpc("decrement_watchlist_count", { p_user_id: userId });
    }

    // ----- TV SHOWS: use user_tv_list (unified tracking) -----
    if (mediaType === "tv") {
      // Upsert into user_tv_list with 'watching' status
      const { error: tvListError } = await supabase.from("user_tv_list").upsert(
        {
          user_id: userId,
          show_id: itemIdStr,
          status: "watching",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,show_id" },
      );

      if (tvListError) {
        if (tvListError.code === "23505") {
          return NextResponse.json(
            { error: "Already in watching list" },
            { status: 409 },
          );
        }
        console.error("Error upserting user_tv_list:", tvListError);
        return NextResponse.json(
          { error: "Error adding to watching" },
          { status: 500 },
        );
      }

      // Ensure the show is also in watched_items (for metadata: name, image, genres)
      const { data: existingWatched } = await supabase
        .from("watched_items")
        .select("id")
        .eq("user_id", userId)
        .eq("item_id", itemIdStr)
        .maybeSingle();

      if (!existingWatched) {
        const { error: insertWatchedError } = await supabase
          .from("watched_items")
          .insert({
            user_id: userId,
            item_id: itemIdStr,
            item_name: name,
            item_type: "tv",
            image_url: imgUrl || null,
            item_adult: adult ?? false,
            genres: genres ?? [],
            is_watched: false, // not fully watched yet, just tracking
          });

        if (insertWatchedError && insertWatchedError.code !== "23505") {
          console.error(
            "Error inserting watched_items for TV:",
            insertWatchedError,
          );
        }
      }

      return NextResponse.json(
        {
          message:
            "Added to watching" +
            (existingWatchlistItem ? " and removed from watchlist" : ""),
        },
        { status: 200 },
      );
    }

    // ----- MOVIES: use currently_watching (unchanged) -----
    const { error: insertError } = await supabase
      .from("currently_watching")
      .insert({
        user_id: userId,
        item_name: name,
        item_id: itemIdStr,
        item_type: mediaType,
        image_url: imgUrl || null,
        item_adult: adult ?? false,
        genres: genres ?? [],
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Already in watching list" },
          { status: 409 },
        );
      }
      console.error("Error inserting currently watching item:", insertError);
      return NextResponse.json(
        { error: "Error adding to watching" },
        { status: 500 },
      );
    }

    // Increment watching_count
    const { error: incrementError } = await supabase.rpc(
      "increment_watching_count",
      {
        p_user_id: userId,
      },
    );
    if (incrementError) {
      console.error("Error incrementing watching_count:", incrementError);
    }

    return NextResponse.json(
      {
        message:
          "Added to watching" +
          (existingWatchlistItem ? " and removed from watchlist" : ""),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in currently-watching POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
