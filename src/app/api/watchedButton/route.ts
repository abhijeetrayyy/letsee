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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const itemId = body.itemId != null ? String(body.itemId) : null;
  const name = typeof body.name === "string" ? body.name : "";
  const mediaType = body.mediaType === "tv" ? "tv" : "movie";
  const imgUrl = typeof body.imgUrl === "string" ? body.imgUrl : null;
  const adult = body.adult === true;
  const genres = Array.isArray(body.genres) ? (body.genres as string[]) : [];
  const episodesPayload = body.episodes;

  if (!itemId || !name) {
    return NextResponse.json(
      { error: "itemId and name are required" },
      { status: 400 }
    );
  }

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
        .eq("item_id", String(itemId));
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
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; details?: string };
    console.error("watchedButton error:", err);
    const message =
      typeof err?.message === "string"
        ? err.message
        : err?.code
          ? String(err.code)
          : "Internal server error";
    return NextResponse.json(
      { error: message },
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
    imgUrl?: string | null;
    adult: boolean;
    genres: string[];
  }
) {
  const { error: insertError } = await supabase.from("watched_items").insert({
    user_id: userId,
    item_name: item.name,
    item_id: String(item.itemId),
    item_type: item.mediaType === "tv" ? "tv" : "movie",
    image_url: item.imgUrl ?? null,
    item_adult: Boolean(item.adult),
    genres: Array.isArray(item.genres) ? item.genres : [],
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
  const rows: WatchedEpisodeRow[] = [];
  for (const season of seasons) {
    const sn = Number(season.season_number);
    if (sn < 0 || Number.isNaN(sn)) continue;
    const seasonRes = await fetchTmdb(
      `https://api.themoviedb.org/3/tv/${showId}/season/${sn}?api_key=${TMDB_API_KEY}`
    );
    if (!seasonRes.ok) {
      const count = Number(season.episode_count) || 0;
      for (let ep = 1; ep <= count; ep++) {
        rows.push({ user_id: userId, show_id: showId, season_number: sn, episode_number: ep });
      }
      continue;
    }
    const seasonData = await seasonRes.json();
    const episodes = Array.isArray(seasonData?.episodes) ? seasonData.episodes : [];
    for (const ep of episodes) {
      const en = Number(ep.episode_number);
      if (en >= 1) {
        rows.push({
          user_id: userId,
          show_id: showId,
          season_number: sn,
          episode_number: en,
        });
      }
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
  const filtered = list.filter(
    (e) =>
      Number.isInteger(e.season_number) &&
      Number.isInteger(e.episode_number) &&
      e.episode_number >= 1
  );
  if (filtered.length === 0) return;

  const rows: WatchedEpisodeRow[] = filtered.map((e) => ({
    user_id: userId,
    show_id: showId,
    season_number: e.season_number,
    episode_number: e.episode_number,
  }));

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

type WatchedEpisodeRow = {
  user_id: string;
  show_id: string;
  season_number: number;
  episode_number: number;
};

async function backfillEpisodesForSeasons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  showId: string,
  seasonNumbers: number[]
) {
  if (!TMDB_API_KEY || seasonNumbers.length === 0) return;
  const rows: WatchedEpisodeRow[] = [];
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
      if (en >= 1) {
        rows.push({
          user_id: userId,
          show_id: showId,
          season_number: sn,
          episode_number: en,
        });
      }
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
