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
): Promise<{ applied: number; errors: string[] }> {
  if (rows.length === 0) return { applied: 0, errors: [] };

  const itemIds = [...new Set(rows.map((r) => r.tmdbId))];

  // One read to learn what the user already has, so nothing below has to guess.
  const [statusRes, watchedRes, takesRes] = await Promise.all([
    supabase
      .from("user_media_status")
      .select("item_id, item_type, status")
      .eq("user_id", userId)
      .in("item_id", itemIds),
    /**
     * The diary comes through the accessor, not the table.
     *
     * 076 revoked SELECT on `watched_items.review_text` from anon and
     * authenticated, because RLS filters rows and not columns and 019's
     * visibility policy was handing the private diary to every visitor.
     * `my_diary_notes` is SECURITY DEFINER and scoped to auth.uid(), so it
     * answers the same question — "has this user already written about this
     * title?" — without the column being readable at all. It returns only rows
     * that HAVE a note, so an absent key means no note, which is what the
     * `hasReview` check below wants.
     */
    supabase.rpc("my_diary_notes", { p_item_ids: itemIds, p_limit: null }),
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
  // `rpc()` has no generated types to infer from, so the row shape is named
  // here rather than left implicitly `any`.
  type DiaryNote = { item_id: string; item_type: string; review_text: string | null };
  const existingReview = new Map(
    ((watchedRes.data ?? []) as DiaryNote[]).map((r) => [
      `${r.item_type}:${r.item_id}`,
      r.review_text,
    ]),
  );

  const existingTake = new Set(
    (takesRes.data ?? []).map((r) => `${r.item_type}:${r.item_id}`),
  );

  const takeInserts: Record<string, unknown>[] = [];
  /** Guards the batch against itself — two rows for one title in a single
      upsert violate the unique constraint and reject the whole statement. */
  const takesInBatch = new Set<string>();

  /**
   * The same guard the takes array has had all along, for the two arrays that
   * actually needed it most.
   *
   * `ON CONFLICT DO UPDATE` refuses to touch a row twice in one statement —
   * SQLSTATE 21000, "cannot affect row a second time" — and it rejects the
   * WHOLE statement, not the offending row. Upstream dedupe is on (title, year)
   * (letterboxd.ts `keyOf`), so two differently-titled CSV lines that resolve
   * to the same TMDB id are two distinct rows in one chunk: an alias, a
   * re-release under a different year, a title in two languages. One such pair
   * in a chunk of 25 meant none of those 25 films got a status or a
   * watched_items row — and they were stamped `applied` anyway, so a re-run
   * would not repair them.
   *
   * Keyed by `type:id` for the usual reason: a film and a series can share a
   * TMDB id.
   *
   * `ratingInserts` and `favoriteInserts` stay plain arrays because they use
   * `ignoreDuplicates` (DO NOTHING), which tolerates repeats inside one
   * statement. Only DO UPDATE has the second-touch rule.
   */
  const statusByKey = new Map<string, Record<string, unknown>>();
  const watchedByKey = new Map<string, Record<string, unknown>>();
  /** Written after the rows land, by set_my_diary_notes — see below. */
  const diaryNotes: { item_id: string; item_type: string; body: string }[] = [];
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

    const rowKey = `${row.tmdbType}:${row.tmdbId}`;
    const current = existingStatus.get(rowKey);
    const inBatch = statusByKey.get(rowKey) as { status?: string } | undefined;

    if (row.watched) {
      statusByKey.set(rowKey, { ...base, status: "watched", updated_at: new Date().toISOString() });
    } else if (row.watchlist && !current && inBatch?.status !== "watched") {
      // Only when there's nothing there. A film they've since watched here must
      // not be knocked back to the watchlist by an old export — and the
      // `inBatch` half says the same thing about a duplicate earlier in this
      // very chunk, which merging without it would silently downgrade.
      statusByKey.set(rowKey, { ...base, status: "watchlist", updated_at: new Date().toISOString() });
    }

    if (row.watched) {
      const hasReview = !!existingReview.get(rowKey);
      // Merged, not replaced: a later duplicate that carries no review must not
      // erase the review the earlier one brought. Spreading leaves absent keys
      // alone and lets present ones win.
      watchedByKey.set(rowKey, {
        ...(watchedByKey.get(rowKey) ?? {}),
        ...base,
        is_watched: true,
        // Letterboxd's watch date is the whole point of importing a diary, so
        // it wins over "now" — but only ever as a date we were actually given.
        ...(row.watchedDate ? { watched_at: new Date(row.watchedDate).toISOString() } : {}),
      });
      /**
       * The diary note is collected, not upserted.
       *
       * Imported into the private diary rather than public_review_text: the
       * review was public on Letterboxd, and that is not consent to republish
       * it here under a different profile's visibility rules.
       *
       * It cannot ride along in the upsert above. 076 revoked SELECT on
       * `review_text`, and `ON CONFLICT DO UPDATE SET review_text =
       * EXCLUDED.review_text` reads that column — so an import carrying any
       * review answered "permission denied" and took its whole chunk with it.
       * set_my_diary_notes writes it as the owner, once the rows exist.
       */
      if (row.reviewText && !hasReview) {
        diaryNotes.push({
          item_id: row.tmdbId,
          item_type: row.tmdbType,
          body: row.reviewText,
        });
      }
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

  const statusUpserts = [...statusByKey.values()];
  const watchedUpserts = [...watchedByKey.values()];

  /**
   * Failures are collected and returned, not logged and forgotten.
   *
   * These five writes used to end in `.then(({ error }) => error && console.error(...))`,
   * so `applyRows` reported the same `{ applied: rows.length }` whether every
   * row landed or none did — and the caller then stamped all of them `applied`.
   * A rejected statement therefore looked exactly like a successful one: the
   * progress bar advanced, the summary said the titles imported, and because
   * the import is idempotent by design, re-running would not put them back.
   */
  const errors: string[] = [];
  const record = (table: string) => ({ error }: { error: { message: string } | null }) => {
    if (!error) return;
    console.error(`import ${table}:`, error);
    errors.push(`${table}: ${error.message}`);
  };

  await Promise.all([
    statusUpserts.length
      ? supabase
          .from("user_media_status")
          .upsert(statusUpserts, { onConflict: "user_id,item_id,item_type" })
          .then(record("user_media_status"))
      : null,
    watchedUpserts.length
      ? supabase
          .from("watched_items")
          .upsert(watchedUpserts, { onConflict: "user_id,item_id,item_type" })
          .then(record("watched_items"))
      : null,
    // ignoreDuplicates is the whole "never clobber" guarantee for these two.
    ratingInserts.length
      ? supabase
          .from("user_ratings")
          .upsert(ratingInserts, { onConflict: "user_id,item_id,item_type", ignoreDuplicates: true })
          .then(record("user_ratings"))
      : null,
    takeInserts.length
      ? supabase
          .from("takes")
          .upsert(takeInserts, {
            onConflict: "user_id,item_id,item_type,scope,season_number,episode_number,is_public",
            ignoreDuplicates: true,
          })
          .then(record("takes"))
      : null,
    favoriteInserts.length
      ? supabase
          .from("favorite_items")
          .upsert(favoriteInserts, { onConflict: "user_id,item_id,item_type", ignoreDuplicates: true })
          .then(record("favorite_items"))
      : null,
  ]);

  /**
   * Notes last, and only into an empty diary.
   *
   * `p_only_if_empty` is this module's opening rule expressed in SQL: an import
   * may add, but never take away. A row the user has written about since keeps
   * what they wrote.
   */
  if (diaryNotes.length > 0) {
    const { error } = await supabase.rpc("set_my_diary_notes", {
      p_notes: diaryNotes,
      p_only_if_empty: true,
    });
    if (error) {
      console.error("import diary notes:", error);
      errors.push(`diary notes: ${error.message}`);
    }
  }

  return { applied: rows.length, errors };
}
