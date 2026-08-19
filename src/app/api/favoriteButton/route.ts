import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
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
  const name = typeof body.name === "string" ? body.name : "";
  const mediaType = body.mediaType === "tv" ? "tv" : "movie";
  const imgUrl = typeof body.imgUrl === "string" ? body.imgUrl : null;
  const adult = body.adult === true;
  const genres = Array.isArray(body.genres) ? (body.genres as string[]) : [];

  if (!itemId || !name) {
    return jsonError("itemId and name are required", 400);
  }

  // Check if already favorited
  const { data: existing, error: findError } = await supabase
    .from("favorite_items")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    // Without the type this matched a film when the user meant the series
    // that happens to share its TMDB id, and maybeSingle() would throw once
    // both existed.
    .eq("item_type", mediaType)
    .maybeSingle();

  if (findError) return jsonError("Failed to check favorite status", 500);

  // If already favorited, remove it (toggle off)
  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorite_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", mediaType);

    if (deleteError) return jsonError(deleteError.message, 500);

    // No decrement_favorites_count. 069's statement-level trigger on
    // favorite_items recounts absolutely on every DELETE, so the counter is
    // already right by the time this line used to run — and a relative
    // `favorites_count - 1` on top of a correct absolute count took one more
    // off. Verified live: cached favorites_count matches the row count exactly.

    /**
     * The displayed four are a subset of favourites, so un-favouriting has to
     * take the title out of the display or the profile keeps showing a film
     * that is no longer a favourite of anyone's.
     */
    await supabase
      .from("user_favorite_display")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", itemId)
      .eq("item_type", mediaType);

    return jsonSuccess({ action: "removed", message: "Removed from favorites" });
  }

  // Add to favorites
  const { error: insertError } = await supabase.from("favorite_items").insert({
    user_id: userId,
    item_name: name,
    item_id: itemId,
    item_type: mediaType,
    image_url: imgUrl,
    item_adult: adult,
    genres,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonSuccess({ message: "Already favorited" });
    }
    return jsonError(insertError.message, 500);
  }

  /**
   * A favourite is a watched thing. Always.
   *
   * You cannot love a film you have not seen, so favouriting one is a claim
   * about having seen it — but the two were stored independently, and nothing
   * connected them. The result was profiles whose favourites were absent from
   * their own watched list, and an onboarding flow that asked for four films
   * you love and then recorded that you had watched none of them.
   *
   * Enforced here rather than in each caller because this route is the only
   * place a favourite is created — the detail page, the cards and the
   * onboarding picker all come through it, so they all inherit the rule.
   *
   * It fills in a missing status and upgrades a watchlist entry, and leaves
   * watching, on_hold and dropped alone. Those already mean you have seen some
   * of it, which is all a favourite requires — overwriting them would throw
   * away a fact the user set on purpose to satisfy a rule that is already
   * satisfied.
   */
  const { data: current } = await supabase
    .from("user_media_status")
    .select("status")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("item_type", mediaType)
    .maybeSingle();
  const needsPromotion = !current?.status || current.status === "watchlist";

  await Promise.all([
    (needsPromotion
      ? supabase
          .from("user_media_status")
          .upsert(
        {
          user_id: userId,
          item_id: itemId,
          item_type: mediaType,
          item_name: name,
          ...(imgUrl ? { image_url: imgUrl } : {}),
          ...(genres.length ? { genres } : {}),
          status: "watched",
          updated_at: new Date().toISOString(),
        },
            { onConflict: "user_id,item_id,item_type" },
          )
          .then(({ error }) => error && console.error("favorite implies seen (status):", error))
      : Promise.resolve()),
    supabase
      .from("watched_items")
      .upsert(
        {
          user_id: userId,
          item_id: itemId,
          item_type: mediaType,
          item_name: name,
          ...(imgUrl ? { image_url: imgUrl } : {}),
          ...(genres.length ? { genres } : {}),
          is_watched: true,
        },
        { onConflict: "user_id,item_id,item_type" },
      )
      .then(({ error }) => error && console.error("favorite implies watched (item):", error)),
  ]);

  /**
   * Recount rather than increment.
   *
   * The directory reads denormalised counters from `user_cout_stats`, and the
   * two writes above go straight to the tables without touching them — so a
   * favourite that newly implied "watched" left watched_count behind. Measured
   * on the two onboarding accounts: stored 0, actual 4, which is what showed on
   * the discover page as a profile with four favourites and nothing watched.
   *
   * `recount_user_stats` derives all of them from the rows, so it cannot drift
   * the way a hand-placed increment can — and it is the honest call here
   * because this request may have changed one counter, two, or none.
   */
  try {
    await supabase.rpc("recount_user_stats", { p_user_id: userId });
  } catch {
    // Deliberately no fallback. The narrow `increment_favorites_count` that used
    // to sit here predates 069, whose trigger already recounted absolutely when
    // the row was inserted — so the fallback could only ever fire on top of an
    // already-correct counter and push it one too high. Leaving this empty is
    // the safe branch now: the trigger is the thing that maintains the count,
    // and the recount above is belt-and-braces.
  }

  return jsonSuccess({ action: "added", message: "Added to favorites" });
}
