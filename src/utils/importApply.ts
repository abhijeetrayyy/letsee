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
  const [statusRes, watchedRes] = await Promise.all([
    supabase
      .from("user_media_status")
      .select("item_id, status")
      .eq("user_id", userId)
      .in("item_id", itemIds),
    supabase
      .from("watched_items")
      .select("item_id, review_text")
      .eq("user_id", userId)
      .in("item_id", itemIds),
  ]);

  const existingStatus = new Map(
    (statusRes.data ?? []).map((r) => [String(r.item_id), r.status as string]),
  );
  const existingReview = new Map(
    (watchedRes.data ?? []).map((r) => [String(r.item_id), r.review_text as string | null]),
  );

  const statusUpserts: Record<string, unknown>[] = [];
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

    const current = existingStatus.get(row.tmdbId);

    if (row.watched) {
      statusUpserts.push({ ...base, status: "watched", updated_at: new Date().toISOString() });
    } else if (row.watchlist && !current) {
      // Only when there's nothing there. A film they've since watched here must
      // not be knocked back to the watchlist by an old export.
      statusUpserts.push({ ...base, status: "watchlist", updated_at: new Date().toISOString() });
    }

    if (row.watched) {
      const hasReview = !!existingReview.get(row.tmdbId);
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
          .upsert(statusUpserts, { onConflict: "user_id,item_id" })
          .then(({ error }) => error && console.error("import status:", error))
      : null,
    watchedUpserts.length
      ? supabase
          .from("watched_items")
          .upsert(watchedUpserts, { onConflict: "user_id,item_id" })
          .then(({ error }) => error && console.error("import watched_items:", error))
      : null,
    // ignoreDuplicates is the whole "never clobber" guarantee for these two.
    ratingInserts.length
      ? supabase
          .from("user_ratings")
          .upsert(ratingInserts, { onConflict: "user_id,item_id", ignoreDuplicates: true })
          .then(({ error }) => error && console.error("import ratings:", error))
      : null,
    favoriteInserts.length
      ? supabase
          .from("favorite_items")
          .upsert(favoriteInserts, { onConflict: "user_id,item_id", ignoreDuplicates: true })
          .then(({ error }) => error && console.error("import favorites:", error))
      : null,
  ]);

  return { applied: rows.length };
}
