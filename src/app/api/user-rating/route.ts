import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { setScore, clearScore, NA } from "@/utils/takes";

/** GET /api/user-rating?itemId=123&itemType=movie — returns { score: number | null } */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError("User isn't logged in", 401);
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const itemType = searchParams.get("itemType");

  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }

  const { data: row, error } = await supabase
    .from("user_ratings")
    .select("score")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle();

  if (error) {
    return jsonError("Failed to fetch rating", 500);
  }
  return jsonSuccess(
    { score: row?.score ?? null },
    { maxAge: 0 }
  );
}

/** POST /api/user-rating — body: { itemId: string, itemType: 'movie'|'tv', score: number } — set/update rating (1-10) */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError("User isn't logged in", 401);
  }

  let body: { itemId?: string; itemType?: string; score?: number; itemName?: string; imageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  /**
   * `itemName` and `imageUrl` are accepted and deliberately unused.
   *
   * The client posts them and this route has always dropped them, which looked
   * like waste. It is not, any more: rating requires a `watched_items` row
   * (see `canRate` below), that table's `item_name` is NOT NULL, and migration
   * 086 has the activity trigger read the name from there. The name is already
   * recorded by the time anything gets here.
   *
   * Writing them anyway would mean patching `user_activity` after its own
   * trigger fired, and that table has no UPDATE policy — adding one to restate
   * a fact the database already holds is more RLS surface for nothing.
   *
   * They stay in the destructure so the shape of what the client sends is
   * visible at the top of the handler rather than only in the client.
   */
  const { itemId, itemType, score } = body;
  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }
  const num = Number(score);
  if (!Number.isInteger(num) || num < 1 || num > 10) {
    return jsonError("score must be an integer from 1 to 10", 400);
  }

  const [
    { data: watchedRow },
    { data: existingRating },
  ] = await Promise.all([
    supabase
      .from("watched_items")
      .select("id, is_watched")
      .eq("user_id", userId)
      .eq("item_id", String(itemId))
      .eq("item_type", itemType)
      .maybeSingle(),
    supabase
      .from("user_ratings")
      .select("id")
      .eq("user_id", userId)
      .eq("item_id", String(itemId))
      .eq("item_type", itemType)
      .maybeSingle(),
  ]);
  const canRate =
    (watchedRow && (watchedRow as { is_watched?: boolean }).is_watched !== false) ||
    !!existingRating;
  if (!canRate) {
    return jsonError("Mark as watched to rate this title", 403);
  }

  /**
   * Through `takes`, not straight into `user_ratings`.
   *
   * 065 made `takes` the source of truth and left `user_ratings` as a
   * projection of it, but this route never got the message: it wrote the
   * projection and nothing else. So the two rating widgets that render on the
   * same movie page disagreed — rate from a card and TitleTalk's stars stayed
   * empty, rate in TitleTalk and its mirror overwrote the card's score. `takes`
   * is what /api/takes, /api/reviews/popular and the following feed all read.
   */
  const err = await setScore(
    supabase,
    userId,
    { itemId: String(itemId), itemType, scope: "title", seasonNumber: NA, episodeNumber: NA },
    num,
  );
  if (err) return jsonError(err, 500);

  return jsonSuccess({ score: num }, { maxAge: 0 });
}

/** DELETE /api/user-rating — body: { itemId: string, itemType: 'movie'|'tv' } — remove rating */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError("User isn't logged in", 401);
  }

  /**
   * Query string first, body second.
   *
   * Every caller in the app sends the identity as query parameters —
   * MediaInteractionProvider.tsx builds `?itemId=…&itemType=…` and passes no
   * third argument, so `apiCall` sends no body at all. This handler only ever
   * read the body, `request.json()` threw on the empty one, and clearing a
   * rating from a card, from MediaActions or from the franchise strip returned
   * 400 every single time. The optimistic update rolled the star straight back
   * and said nothing, so it read as a missed tap.
   *
   * /api/user-media-status DELETE already takes its identity from the URL; this
   * matches it, and still accepts a body so any future caller works either way.
   */
  const url = new URL(request.url);
  let itemId = url.searchParams.get("itemId") ?? undefined;
  let itemType = url.searchParams.get("itemType") ?? undefined;

  if (!itemId || !itemType) {
    try {
      const body = (await request.json()) as { itemId?: string; itemType?: string };
      itemId = itemId ?? body.itemId;
      itemType = itemType ?? body.itemType;
    } catch {
      // No body, or an unparseable one. Only fatal if the query string was
      // empty too, which the check below decides.
    }
  }

  if (!itemId || !itemType) {
    return jsonError("Missing itemId or itemType", 400);
  }
  if (itemType !== "movie" && itemType !== "tv") {
    return jsonError("itemType must be movie or tv", 400);
  }

  const { data: watchedRow } = await supabase
    .from("watched_items")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", String(itemId))
    .eq("item_type", itemType)
    .maybeSingle();
  if (!watchedRow) {
    return jsonError("Mark as watched to rate this title", 403);
  }

  // Same reason as POST: `takes` is the source of truth, `user_ratings` its
  // projection. Deleting only the projection left the take holding the score,
  // so the title page still showed a rating the user had just withdrawn — and
  // the next save mirrored it straight back. clearScore keeps any review the
  // take is carrying and removes the number from both places.
  const err = await clearScore(supabase, userId, {
    itemId: String(itemId),
    itemType,
    scope: "title",
    seasonNumber: NA,
    episodeNumber: NA,
  });
  if (err) return jsonError(err, 500);

  return jsonSuccess({ score: null }, { maxAge: 0 });
}
