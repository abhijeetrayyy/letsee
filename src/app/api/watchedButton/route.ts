import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchTmdb } from "@/utils/tmdbClient";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return NextResponse.json(
      { error: "User isn't logged in" },
      { status: 401 }
    );
  }

  const userId = userData.user.id;
  const body = await req.json();
  const { itemId, name, mediaType, imgUrl, adult, genres, episodes: episodesPayload } = body;

  try {
    const { data: existingItem, error: findError } = await supabase
      .from("watched_items")
      .select("id, is_watched, item_type")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (existingItem) {
      const isWatched = (existingItem as { is_watched?: boolean }).is_watched !== false;
      if (isWatched) {
        await removeFromWatched(userId, itemId);
        if (mediaType === "tv") {
          await clearWatchedEpisodesForShow(supabase, userId, String(itemId));
        }
        await supabase
          .from("user_ratings")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", String(itemId))
          .eq("item_type", (existingItem as { item_type: string }).item_type);
        return NextResponse.json(
          { message: "Removed from watched", action: "removed" },
          { status: 200 }
        );
      }
      const { error: updateError } = await supabase
        .from("watched_items")
        .update({ is_watched: true })
        .eq("user_id", userId)
        .eq("item_id", itemId);
      if (updateError) throw updateError;
      const { error: incError } = await supabase.rpc("increment_watched_count", {
        p_user_id: userId,
      });
      if (incError) console.error("watchedButton re-add increment:", incError);
      return NextResponse.json(
        { message: "Added back to watched", action: "added" },
        { status: 200 }
      );
    }

    const { data: watchlistItem, error: watchlistError } = await supabase
      .from("user_watchlist")
      .select()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .single();

    if (watchlistError && watchlistError.code !== "PGRST116") {
      throw watchlistError;
    }
    if (watchlistItem) {
      await removeFromWatchlist(userId, itemId);
    }

    await addToWatched(supabase, userId, {
      itemId,
      name,
      mediaType,
      imgUrl,
      adult,
      genres,
    });

    if (mediaType === "tv") {
      const listPayload = Array.isArray(episodesPayload?.list) && episodesPayload.list.length > 0
        ? (episodesPayload.list as { season_number: number; episode_number: number }[])
        : null;
      const seasonsOnly =
        Array.isArray(episodesPayload?.seasons) && episodesPayload.seasons.length > 0
          ? (episodesPayload.seasons as number[])
          : null;
      if (listPayload) {
        await insertWatchedEpisodesList(supabase, userId, String(itemId), listPayload);
      } else if (seasonsOnly) {
        await backfillEpisodesForSeasons(supabase, userId, String(itemId), seasonsOnly);
      } else {
        await backfillAllEpisodesForShow(supabase, userId, String(itemId));
      }
    }

    return NextResponse.json(
      { message: "Added to watched", action: "added" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Adds an item to the watched list and increments the watched count.
 */
async function addToWatched(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  item: {
    itemId: string;
    name: string;
    mediaType: string;
    imgUrl: string;
    adult: boolean;
    genres: string[];
  }
) {
  const { error: insertError } = await supabase.from("watched_items").insert({
    user_id: userId,
    item_name: item.name,
    item_id: item.itemId,
    item_type: item.mediaType,
    image_url: item.imgUrl,
    item_adult: item.adult,
    genres: item.genres,
  });

  if (insertError) {
    throw insertError;
  }

  const { error: incrementError } = await supabase.rpc(
    "increment_watched_count",
    {
      p_user_id: userId,
    }
  );

  if (incrementError) {
    throw incrementError;
  }
}

/**
 * Removes an item from the watched list and decrements the watched count.
 */
async function removeFromWatched(userId: string, itemId: string) {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("watched_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  if (deleteError) {
    throw deleteError;
  }

  const { error: decrementError } = await supabase.rpc(
    "decrement_watched_count",
    {
      p_user_id: userId,
    }
  );

  if (decrementError) {
    throw decrementError;
  }
}

async function clearWatchedEpisodesForShow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string
) {
  const { error } = await supabase
    .from("watched_episodes")
    .delete()
    .eq("user_id", userId)
    .eq("show_id", showId);
  if (error) console.error("clearWatchedEpisodesForShow:", error);
}

async function backfillAllEpisodesForShow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string
) {
  if (!TMDB_API_KEY) return;
  const res = await fetchTmdb(
    `https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}&append_to_response=seasons`
  );
  if (!res.ok) return;
  const data = await res.json();
  const seasons = Array.isArray(data?.seasons) ? data.seasons : [];
  const rows: { user_id: string; show_id: string; season_number: number; episode_number: number }[] = [];
  for (const season of seasons) {
    const sn = Number(season.season_number);
    if (sn < 0 || Number.isNaN(sn)) continue;
    const count = Number(season.episode_count) || 0;
    for (let ep = 1; ep <= count; ep++) {
      rows.push({ user_id: userId, show_id: showId, season_number: sn, episode_number: ep });
    }
  }
  if (rows.length === 0) return;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("watched_episodes").upsert(chunk, {
      onConflict: "user_id,show_id,season_number,episode_number",
      ignoreDuplicates: true,
    });
    if (error) console.error("backfillAllEpisodesForShow chunk:", error);
  }
}

/**
 * Insert a specific list of (season_number, episode_number) into watched_episodes.
 */
async function insertWatchedEpisodesList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string,
  list: { season_number: number; episode_number: number }[]
) {
  if (list.length === 0) return;
  const rows = list
    .filter((e) => Number.isInteger(e.season_number) && Number.isInteger(e.episode_number) && e.episode_number >= 1)
    .map((e) => ({
      user_id: userId,
      show_id: showId,
      season_number: e.season_number,
      episode_number: e.episode_number,
    }));
  if (rows.length === 0) return;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("watched_episodes").upsert(chunk, {
      onConflict: "user_id,show_id,season_number,episode_number",
      ignoreDuplicates: true,
    });
    if (error) console.error("insertWatchedEpisodesList chunk:", error);
  }
}

async function backfillEpisodesForSeasons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string,
  seasonNumbers: number[]
) {
  if (!TMDB_API_KEY || seasonNumbers.length === 0) return;
  const rows: { user_id: string; show_id: string; season_number: number; episode_number: number }[] = [];
  for (const sn of seasonNumbers) {
    if (sn < 0 || !Number.isInteger(sn)) continue;
    const res = await fetchTmdb(
      `https://api.themoviedb.org/3/tv/${showId}/season/${sn}?api_key=${TMDB_API_KEY}`
    );
    if (!res.ok) continue;
    const data = await res.json();
    const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
    for (const ep of episodes) {
      const en = Number(ep.episode_number);
      if (en >= 1) rows.push({ user_id: userId, show_id: showId, season_number: sn, episode_number: en });
    }
  }
  if (rows.length === 0) return;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("watched_episodes").upsert(chunk, {
      onConflict: "user_id,show_id,season_number,episode_number",
      ignoreDuplicates: true,
    });
    if (error) console.error("backfillEpisodesForSeasons chunk:", error);
  }
}

/**
 * Removes an item from the watchlist and decrements the watchlist count.
 */
async function removeFromWatchlist(userId: string, itemId: string) {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("user_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  if (deleteError) {
    throw deleteError;
  }

  const { error: decrementError } = await supabase.rpc(
    "decrement_watchlist_count",
    {
      p_user_id: userId,
    }
  );

  if (decrementError) {
    throw decrementError;
  }
}
