import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { writeStatus } from "@/utils/mediaStatus";

import { guard } from "@/lib/limits/guard";
const VALID_STATUSES = ["watchlist", "watching", "watched", "on_hold", "dropped"] as const;
type MediaStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: unknown): s is MediaStatus {
  return typeof s === "string" && VALID_STATUSES.includes(s as MediaStatus);
}

export async function PUT(req: NextRequest) {
  const limited = await guard("write", req);
  if (limited) return limited;
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const itemId = body.itemId != null ? String(body.itemId) : null;
  const itemType = body.itemType === "tv" ? "tv" : "movie";
  const status = body.status;
  const itemName = typeof body.name === "string" ? body.name : (body.itemName as string) || "";
  const rawImageUrl = typeof body.imgUrl === "string" ? body.imgUrl : (body.imageUrl as string) || "";
  const imageUrl = rawImageUrl.trim() || null;
  const adult = body.adult === true;
  const genres = Array.isArray(body.genres) ? (body.genres as string[]) : [];

  if (!itemId) return jsonError("itemId is required", 400);
  if (!isValidStatus(status)) return jsonError("Invalid status. Must be one of: watchlist, watching, watched, on_hold, dropped", 400);

  /**
   * A save carries a why, a when and a who (097).
   *
   * All optional, all only meaningful on a watchlist row, and all kept on the
   * row after it is watched — the note is part of the memory. A "who" that is
   * a person on letsee is also recorded as a recommendation *from* them, so
   * the loop can close when the title gets watched.
   */
  const save = parseSave(body);

  /**
   * The person a save came from has to be somebody the caller is connected
   * to. A recommendation is later *closed* with a notification to its sender
   * (097), so an unchecked id here would let anyone make anyone "say" they
   * recommended a film. 097's insert policy refuses it too; this is the
   * message a person reads instead of a policy error.
   */
  if (save.fromUserId && save.fromUserId !== userId) {
    const { count } = await supabase
      .from("user_connections")
      .select("follower_id", { count: "exact", head: true })
      .or(
        `and(follower_id.eq.${userId},followed_id.eq.${save.fromUserId}),and(follower_id.eq.${save.fromUserId},followed_id.eq.${userId})`,
      );
    if (!count) {
      // Keep the intent as a plain name rather than refusing the save.
      const { data: named } = await supabase.from("users").select("username").eq("id", save.fromUserId).maybeSingle();
      save.columns.save_with_user_id = null;
      save.columns.save_with_name = named?.username ?? null;
      save.fromUserId = null;
    }
  }

  /**
   * `saved_at` is the day it first went on the list, so it is stamped on the
   * transition into 'watchlist' and left alone by everything after — a note
   * edit re-sends status 'watchlist', and must not make a months-old save
   * look like today's (the watchlist sorts by it, and the availability cron
   * treats a same-day save as "not news").
   */
  const { data: before } = await supabase
    .from("user_media_status")
    .select("status")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle();
  const enteringWatchlist = status === "watchlist" && before?.status !== "watchlist";

  const statusError = await writeStatus(supabase, userId, {
    itemId,
    itemType,
    status,
    itemName,
    imageUrl,
    adult,
    genres,
    // A quick mark ("Watched" on a poster) is seen-it, not watched-today.
    dated: body.dated !== false,
    extra: {
      ...(enteringWatchlist ? { saved_at: new Date().toISOString() } : {}),
      ...save.columns,
    },
  });
  if (statusError) return jsonError(statusError, 500);

  if (save.fromUserId && save.fromUserId !== userId) {
    // "Priya said": written by the recipient, so `to_user_id` is the caller.
    // The identity key makes a second save of the same title a no-op.
    const { error: recError } = await supabase.from("title_recommendations").upsert(
      {
        from_user_id: save.fromUserId,
        to_user_id: userId,
        item_id: itemId,
        item_type: itemType,
        item_name: itemName,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(save.columns.save_note ? { note: save.columns.save_note } : {}),
      },
      { onConflict: "from_user_id,to_user_id,item_id,item_type", ignoreDuplicates: true },
    );
    if (recError) console.error("user-media-status recommendation:", recError);
  }

  /**
   * A favourite requires having SEEN it. Only watchlist — a thing you have not
   * started — is incompatible with calling it a favourite. The display goes
   * first: it is the row a stranger sees, and it must never be the one that
   * survives a partial failure.
   */
  if (status === "watchlist") {
    await supabase
      .from("user_favorite_display")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType);

    await supabase
      .from("favorite_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType);
  }

  // Counters are maintained by 069/078's statement triggers on
  // user_media_status, favorite_items and watched_episodes — the write above
  // already recounted inside its own transaction. An explicit recount here is a
  // second cross-region round trip for a number that is already correct.

  return jsonSuccess({ ok: true, status });
}

export async function DELETE(req: NextRequest) {
  const limited = await guard("write", req);
  if (limited) return limited;
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  // TMDB numbers films and series separately, so an id alone identifies two
  // possible titles. Without the type this deleted both.
  const itemType = url.searchParams.get("itemType") === "tv" ? "tv" : "movie";
  // The confirm dialog offers "keep my rating, diary & review" vs "delete
  // everything". Both used to do the same thing because this flag was never
  // sent or read — the destructive option destroyed nothing.
  const keepData = url.searchParams.get("keepData") !== "false";

  if (!itemId) return jsonError("itemId is required", 400);

  const { error } = await supabase
    .from("user_media_status")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType);

  if (error) {
    console.error("user-media-status delete:", error);
    return jsonError(error.message, 500);
  }

  if (keepData) {
    // Drop it out of the Films grid and diary listings, but keep the row so
    // the rating, diary entry and public review survive.
    await supabase
      .from("watched_items")
      .update({ is_watched: false })
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType);
  } else {
    await Promise.all([
      supabase.from("watched_items").delete().eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType),
      supabase.from("user_ratings").delete().eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType),
      /**
       * `takes` too — this is the only copy anybody else can see.
       *
       * 065 made `takes` the source of truth and left the two columns on
       * `watched_items` as a projection of it. This branch cleared the
       * projection and not the source, so "delete everything" removed the
       * review from the author's own profile — which made it look like it had
       * worked — while the take itself stayed live on the film's page
       * (/api/takes), in "What people wrote" on the home page
       * (/api/reviews/popular) and in every follower's feed
       * (/api/feed/following). Reporting success and leaving the public copy is
       * the worst shape a delete bug can take.
       *
       * No scope filter: for a series this is meant to take the season and
       * episode takes with it. The user asked for everything about this title.
       */
      supabase.from("takes").delete().eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType),
      // The dated viewings are diary too. "Keep my rating, diary & review"
      // keeps them; "delete everything" does what it says.
      supabase.from("viewings").delete().eq("user_id", userId).eq("item_id", itemId).eq("item_type", itemType),
      // Episodes only exist for series, so this is a no-op for a film.
      ...(itemType === "tv"
        ? [supabase.from("watched_episodes").delete().eq("user_id", userId).eq("show_id", itemId)]
        : []),
    ]);
  }

  /**
   * Removing from watched removes the favourite, and the display with it.
   *
   * The chain only ever ran one way: favouriting marked a title watched, and
   * nothing did the reverse. So you could take a film out of your lists and it
   * stayed in your favourites, and stayed in the four films on your profile —
   * a profile claiming you love something your own watched list no longer
   * admits you have seen.
   *
   * Order matters. `user_favorite_display` before `favorite_items`, because the
   * display is what a stranger sees and it must never be the row that survives.
   */
  await supabase
    .from("user_favorite_display")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType);

  await supabase
    .from("favorite_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType);

  /**
   * Remove the feed entries too, or removing a title does not remove it.
   *
   * `user_activity` is written by triggers — `040` on entering `watching`,
   * `051` on watching a title — and **nothing has ever deleted from it**.
   * So taking something off your list cleared `user_media_status`, flipped
   * `watched_items`, and left the activity rows behind, where the home feed
   * reads them. The title stayed in "what people are saying" permanently, with
   * no control anywhere in the app that could remove it.
   *
   * Found because a show called *London Plus* would not go away: its status row
   * was gone and its activity row was not, so the feed kept announcing it.
   *
   * Runs on both branches. `keepData` protects a rating, a diary entry and a
   * review — things the user wrote. It was never meant to protect an
   * auto-generated "started watching" announcement for a title they have just
   * said they are not watching.
   */
  const { error: activityError } = await supabase
    .from("user_activity")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType);

  if (activityError) {
    // Not fatal — the title is off the list either way — but it will linger in
    // the feed, so it should be visible in the logs rather than silent.
    console.error("user-media-status delete (activity):", activityError);
  }

  // Counters are maintained by 069/078's statement triggers on
  // user_media_status, favorite_items and watched_episodes — the write above
  // already recounted inside its own transaction. An explicit recount here is a
  // second cross-region round trip for a number that is already correct.

  return jsonSuccess({ ok: true, removed: true });
}

export async function GET(req: NextRequest) {
  const limited = await guard("heavy", req);
  if (limited) return limited;
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const itemType = url.searchParams.get("itemType") === "tv" ? "tv" : "movie";

  if (itemId) {
    const { data, error } = await supabase
      .from("user_media_status")
      .select("status, updated_at")
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", itemType)
      .maybeSingle();

    if (error) return jsonError(error.message, 500);

    return jsonSuccess({ status: data?.status ?? null });
  }

  // Return all statuses for the current user (used to hydrate client state)
  const { data, error } = await supabase
    .from("user_media_status")
    .select("item_id, item_type, status")
    .eq("user_id", userId);

  if (error) return jsonError(error.message, 500);

  /**
   * Keyed `type:id`, not `id`.
   *
   * TMDB numbers films and series independently, so a bare id is ambiguous —
   * a user holding both movie 550 and tv 550 had one silently overwrite the
   * other in this map, and the client rendered whichever won for both. The
   * client builds the same key via `mediaKey()`.
   */
  const statuses: Record<string, string> = {};
  for (const row of data ?? []) {
    statuses[`${row.item_type}:${row.item_id}`] = row.status;
  }

  return jsonSuccess(statuses);
}

type SaveFields = {
  columns: {
    save_note?: string | null;
    save_for?: string | null;
    save_for_date?: string | null;
    save_with_user_id?: string | null;
    save_with_name?: string | null;
  };
  fromUserId: string | null;
};

const SAVE_FOR = ["tonight", "weekend", "someday", "date"] as const;

/**
 * Only the fields the request actually sent are written, so a status-only
 * update (the TV dropdown, the compact cycle button) never blanks a note
 * somebody typed on the detail page.
 */
function parseSave(body: Record<string, unknown>): SaveFields {
  const columns: SaveFields["columns"] = {};
  let fromUserId: string | null = null;

  if ("saveNote" in body) {
    const note = typeof body.saveNote === "string" ? body.saveNote.trim().slice(0, 280) : "";
    columns.save_note = note || null;
  }
  if ("saveFor" in body) {
    const raw = body.saveFor;
    const value = typeof raw === "string" && (SAVE_FOR as readonly string[]).includes(raw) ? raw : null;
    columns.save_for = value;
    if (value !== "date") columns.save_for_date = null;
  }
  if ("saveForDate" in body) {
    const raw = typeof body.saveForDate === "string" ? body.saveForDate.trim() : "";
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(raw).getTime());
    columns.save_for_date = ok ? raw : null;
    if (ok) columns.save_for = "date";
  }
  // "A date" with no date is not a plan.
  if (columns.save_for === "date" && !columns.save_for_date) columns.save_for = null;
  if ("saveWithUserId" in body) {
    const raw = typeof body.saveWithUserId === "string" ? body.saveWithUserId.trim() : "";
    columns.save_with_user_id = raw || null;
    if (raw) {
      columns.save_with_name = null;
      fromUserId = raw;
    }
  }
  if ("saveWithName" in body) {
    const raw = typeof body.saveWithName === "string" ? body.saveWithName.trim().slice(0, 60) : "";
    columns.save_with_name = raw || null;
    if (raw) columns.save_with_user_id = null;
  }
  return { columns, fromUserId };
}
