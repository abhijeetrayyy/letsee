/**
 * Writing a resolved import row into the user's actual library.
 *
 * The governing rule is **an import may add, but never take away**. Someone
 * importing five years of Letterboxd history has usually already been using
 * this app for a bit, and the worst possible outcome is a "migration" that
 * silently overwrites the rating they set here last week with the one they gave
 * on another site in 2019.
 *
 * So every write is either an insert-if-absent or a promotion:
 *
 *   status     watched wins outright; watchlist only fills an empty slot, so a
 *              film already marked watched is never demoted back to "planned".
 *   rating     insert-if-absent. First import seeds it, re-imports leave it.
 *   review     only fills a null diary entry.
 *   take       insert-if-absent, and only when the title has no take at
 *              either visibility — this is the row the app actually renders.
 *   favourite  insert-if-absent.
 *
 * A consequence worth stating: running the same import twice is a no-op the
 * second time, which is what makes retrying a half-finished import safe.
 */

import type { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ApplicableRow = {
  id: number;
  tmdbId: string;
  tmdbType: "movie" | "tv";
  matchedTitle: string;
  posterPath: string | null;
  genres: string[];
  watched: boolean;
  watchlist: boolean;
  favorite: boolean;
  rating: number | null;
  reviewText: string | null;
  watchedDate: string | null;
};

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

function posterUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${POSTER_BASE}${path}`;
}

/**
 * Apply a batch of resolved rows. Batched rather than per-row because the
 * existing-state read is the expensive part and it amortises across the chunk.
 */
export async function applyRows(
  supabase: SupabaseClient,
  userId: string,
  rows: ApplicableRow[],
): Promise<{ applied: number }> {
  if (rows.length === 0) return { applied: 0 };

  const itemIds = [...new Set(rows.map((r) => r.tmdbId))];

  // One read to learn what the user already has, so nothing below has to guess.
  const [statusRes, watchedRes, takesRes] = await Promise.all([
    supabase
      .from("user_media_status")
      .select("item_id, item_type, status")
      .eq("user_id", userId)
      .in("item_id", itemIds),
    supabase
      .from("watched_items")
      .select("item_id, item_type, review_text")
      .eq("user_id", userId)
      .in("item_id", itemIds),
    /**
     * Both visibilities, deliberately.
     *
     * `takes_identity_key` includes `is_public`, so a private insert alongside
     * an existing public take does not collide — it creates a SECOND take on
     * one title, which is the split-row bug this codebase has already had to
     * repair once. Any take at all means the user has spoken about this title
     * here, and an import does not get to speak over them.
     */
    supabase
      .from("takes")
      .select("item_id, item_type")
      .eq("user_id", userId)
      .eq("scope", "title")
      .in("item_id", itemIds),
  ]);

  // Keyed `type:id`. These maps decide whether a row is downgraded, so a bare
  // id could judge a film against the series sharing its TMDB id.
  const existingStatus = new Map(
    (statusRes.data ?? []).map((r) => [`${r.item_type}:${r.item_id}`, r.status as string]),
  );
  const existingReview = new Map(
    (watchedRes.data ?? []).map((r) => [`${r.item_type}:${r.item_id}`, r.review_text as string | null]),
  );

  const existingTake = new Set(
    (takesRes.data ?? []).map((r) => `${r.item_type}:${r.item_id}`),
  );

  const statusUpserts: Record<string, unknown>[] = [];
  const takeInserts: Record<string, unknown>[] = [];
  /** Guards the batch against itself — two rows for one title in a single
      upsert violate the unique constraint and reject the whole statement. */
  const takesInBatch = new Set<string>();
  const watchedUpserts: Record<string, unknown>[] = [];
  const ratingInserts: Record<string, unknown>[] = [];
  const favoriteInserts: Record<string, unknown>[] = [];

  for (const row of rows) {
    const base = {
      user_id: userId,
      item_id: row.tmdbId,
      item_type: row.tmdbType,
      item_name: row.matchedTitle,
      genres: row.genres,
      ...(posterUrl(row.posterPath) ? { image_url: posterUrl(row.posterPath) } : {}),
    };

    const current = existingStatus.get(`${row.tmdbType}:${row.tmdbId}`);

    if (row.watched) {
      statusUpserts.push({ ...base, status: "watched", updated_at: new Date().toISOString() });
    } else if (row.watchlist && !current) {
      // Only when there's nothing there. A film they've since watched here must
      // not be knocked back to the watchlist by an old export.
      statusUpserts.push({ ...base, status: "watchlist", updated_at: new Date().toISOString() });
    }

    if (row.watched) {
      const hasReview = !!existingReview.get(`${row.tmdbType}:${row.tmdbId}`);
      watchedUpserts.push({
        ...base,
        is_watched: true,
        // Letterboxd's watch date is the whole point of importing a diary, so
        // it wins over "now" — but only ever as a date we were actually given.
        ...(row.watchedDate ? { watched_at: new Date(row.watchedDate).toISOString() } : {}),
        // Imported into the private diary, not public_review_text. The review
        // was public on Letterboxd; that is not consent to republish it here
        // under a different profile's visibility rules.
        ...(row.reviewText && !hasReview ? { review_text: row.reviewText } : {}),
      });
    }

    /**
     * The take is the record that actually gets read.
     *
     * Everything that displays writing — the thread on a title page, the feed,
     * popular reviews — reads `takes` since migration 065. Writing only the
     * legacy tables meant an imported review landed somewhere nothing renders:
     * the rating still counted, because the histogram reads `user_ratings`,
     * but five years of someone's writing arrived invisible.
     *
     * Private, matching the review policy above: it was public on Letterboxd,
     * which is not consent to republish it here under a different profile's
     * visibility rules. `is_public` is a decision the owner makes afterwards.
     */
    const takeKey = `${row.tmdbType}:${row.tmdbId}`;
    const takeBody = row.reviewText?.trim() || null;
    if (
      (row.rating !== null || takeBody) &&
      !existingTake.has(takeKey) &&
      !takesInBatch.has(takeKey)
    ) {
      takesInBatch.add(takeKey);
      takeInserts.push({
        user_id: userId,
        item_id: row.tmdbId,
        item_type: row.tmdbType,
        scope: "title",
        // -1, not 0 — season 0 is Specials, so 0 would be a real season.
        season_number: -1,
        episode_number: -1,
        score: row.rating,
        body: takeBody,
        is_public: false,
        ...(row.watchedDate ? { watched_at: new Date(row.watchedDate).toISOString() } : {}),
      });
    }

    if (row.rating !== null) {
      ratingInserts.push({
        user_id: userId,
        item_id: row.tmdbId,
        item_type: row.tmdbType,
        score: row.rating,
      });
    }

    if (row.favorite) {
      favoriteInserts.push({ ...base, item_name: row.matchedTitle });
    }
  }

  await Promise.all([
    statusUpserts.length
      ? supabase
          .from("user_media_status")
          .upsert(statusUpserts, { onConflict: "user_id,item_id,item_type" })
          .then(({ error }) => error && console.error("import status:", error))
      : null,
    watchedUpserts.length
      ? supabase
          .from("watched_items")
          .upsert(watchedUpserts, { onConflict: "user_id,item_id,item_type" })
          .then(({ error }) => error && console.error("import watched_items:", error))
      : null,
    // ignoreDuplicates is the whole "never clobber" guarantee for these two.
    ratingInserts.length
      ? supabase
          .from("user_ratings")
          .upsert(ratingInserts, { onConflict: "user_id,item_id,item_type", ignoreDuplicates: true })
          .then(({ error }) => error && console.error("import ratings:", error))
      : null,
    takeInserts.length
      ? supabase
          .from("takes")
          .upsert(takeInserts, {
            onConflict: "user_id,item_id,item_type,scope,season_number,episode_number,is_public",
            ignoreDuplicates: true,
          })
          .then(({ error }) => error && console.error("import takes:", error))
      : null,
    favoriteInserts.length
      ? supabase
          .from("favorite_items")
          .upsert(favoriteInserts, { onConflict: "user_id,item_id,item_type", ignoreDuplicates: true })
          .then(({ error }) => error && console.error("import favorites:", error))
      : null,
  ]);

  return { applied: rows.length };
}
