/**
 * Reading and writing a "take" — one person's opinion about one thing.
 *
 * ── Why the legacy tables are still written ────────────────────────────────
 * 36 files read `user_ratings` and `watched_items`' text columns: the profile
 * grid, the activity feed, Year in Review, the public reviews list, the review
 * permalink, the import, the export, the recommendation engines. Switching all
 * of them in one change would be a rewrite with no safe middle, so this
 * **dual-writes**: every take is saved to `takes` *and* mirrored back to the
 * columns those readers already use.
 *
 * The mirror is deliberately one-directional. `takes` is the source of truth
 * from here on; the legacy columns are a projection of it kept alive until
 * their readers move. Nothing reads the legacy columns to build a take.
 *
 * Dropping the mirror is a later, separate decision — see
 * EXPRESSION_AND_DISCOVERY.md §D1.
 */

import type { createClient } from "@/utils/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type TakeScope = "title" | "season" | "episode";

/** -1 means "not applicable at this scope". Not 0 — season 0 is specials. */
export const NA = -1;

export type TakeIdentity = {
  itemId: string;
  itemType: "movie" | "tv";
  scope: TakeScope;
  seasonNumber: number;
  episodeNumber: number;
};

export type Take = {
  score: number | null;
  body: string;
  isPublic: boolean;
  updatedAt: string | null;
};

/** Coerce whatever the client sent into a valid, shape-checked identity. */
export function parseIdentity(raw: Record<string, unknown>): TakeIdentity | null {
  const itemId = raw.itemId != null ? String(raw.itemId).trim() : "";
  if (!itemId) return null;

  const itemType = raw.itemType === "tv" ? "tv" : "movie";
  const scope: TakeScope =
    raw.scope === "season" ? "season" : raw.scope === "episode" ? "episode" : "title";

  const season = Number(raw.seasonNumber);
  const episode = Number(raw.episodeNumber);

  // Mirrors the takes_scope_shape constraint. Rejecting here gives a clear
  // 400 instead of a constraint violation surfacing as a 500.
  if (scope === "title") return { itemId, itemType, scope, seasonNumber: NA, episodeNumber: NA };
  if (scope === "season") {
    if (!Number.isInteger(season) || season < 0) return null;
    return { itemId, itemType, scope, seasonNumber: season, episodeNumber: NA };
  }
  if (!Number.isInteger(season) || season < 0) return null;
  if (!Number.isInteger(episode) || episode < 1) return null;
  return { itemId, itemType, scope, seasonNumber: season, episodeNumber: episode };
}

function match(q: any, id: TakeIdentity, userId: string) {
  return q
    .eq("user_id", userId)
    .eq("item_id", id.itemId)
    .eq("item_type", id.itemType)
    .eq("scope", id.scope)
    .eq("season_number", id.seasonNumber)
    .eq("episode_number", id.episodeNumber);
}

/**
 * The caller's take on one thing.
 *
 * A person can hold both a private note and a public review — see 065 for why
 * that survived into the model. The public one is returned as the primary
 * take, since it is the one other people see; the private note comes alongside
 * rather than being hidden.
 */
export async function getMyTake(
  supabase: SupabaseClient,
  userId: string,
  id: TakeIdentity,
): Promise<{ take: Take | null; privateNote: Take | null }> {
  const { data } = await match(
    supabase.from("takes").select("score, body, is_public, updated_at"),
    id,
    userId,
  );

  type Row = { score: number | null; body: string | null; is_public: boolean; updated_at: string | null };
  const rows: Take[] = ((data ?? []) as Row[]).map((r) => ({
    score: r.score ?? null,
    body: r.body ?? "",
    isPublic: r.is_public === true,
    updatedAt: r.updated_at ?? null,
  }));

  const pub = rows.find((r: Take) => r.isPublic) ?? null;
  const priv = rows.find((r: Take) => !r.isPublic) ?? null;

  return { take: pub ?? priv, privateNote: pub ? priv : null };
}

export type SaveTakeInput = {
  score?: number | null;
  body?: string | null;
  isPublic?: boolean;
  watchedAt?: string | null;
  /** Only used to keep the legacy mirror's metadata columns populated. */
  itemName?: string;
  imageUrl?: string | null;
  genres?: string[];
};

/**
 * Save a take, then mirror it to the legacy columns.
 *
 * Returns an error string rather than throwing, because the routes turn it
 * into a message a person reads.
 */
export async function saveTake(
  supabase: SupabaseClient,
  userId: string,
  id: TakeIdentity,
  input: SaveTakeInput,
): Promise<string | null> {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const isPublic = input.isPublic === true;
  const score =
    input.score === null || input.score === undefined ? null : Math.round(Number(input.score));

  if (score !== null && (!Number.isInteger(score) || score < 1 || score > 10)) {
    return "A rating has to be between 1 and 10.";
  }
  // Matches takes_not_empty. An empty take is a delete, and the routes send it
  // there instead.
  if (score === null && !body) return "Nothing to save.";

  /**
   * Changing visibility has to MOVE the take, not copy it.
   *
   * `takes_identity_key` includes `is_public`, so an upsert keyed on that
   * constraint treats "the same take, now public" as a different row and
   * inserts alongside the private one. The result is two takes on one title —
   * exactly the split D1 existed to abolish — and no way to unpublish. One
   * account in the live database had already ended up in that state.
   *
   * The legacy two-row case is deliberate and must survive: the 065 backfill
   * split anyone holding *both* a private diary entry and a public review into
   * two rows, because those genuinely were two different pieces of writing.
   *
   * So: look first. Exactly one existing take means the composer is editing
   * that one, and a visibility change moves it. Two means the legacy split,
   * and each stays separately addressable.
   */
  const { data: existing } = await supabase
    .from("takes")
    .select("is_public")
    .eq("user_id", userId)
    .eq("item_id", id.itemId)
    .eq("item_type", id.itemType)
    .eq("scope", id.scope)
    .eq("season_number", id.seasonNumber)
    .eq("episode_number", id.episodeNumber);

  const rows = existing ?? [];
  if (rows.length === 1 && rows[0].is_public !== isPublic) {
    await supabase
      .from("takes")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", id.itemId)
      .eq("item_type", id.itemType)
      .eq("scope", id.scope)
      .eq("season_number", id.seasonNumber)
      .eq("episode_number", id.episodeNumber)
      .eq("is_public", rows[0].is_public);
  }

  const { error } = await supabase.from("takes").upsert(
    {
      user_id: userId,
      item_id: id.itemId,
      item_type: id.itemType,
      scope: id.scope,
      season_number: id.seasonNumber,
      episode_number: id.episodeNumber,
      score,
      body: body || null,
      is_public: isPublic,
      ...(input.watchedAt ? { watched_at: input.watchedAt } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_id,item_type,scope,season_number,episode_number,is_public" },
  );

  if (error) {
    console.error("saveTake:", error);
    return "Couldn't save that.";
  }

  /**
   * Keep the score consistent across both visibilities.
   *
   * A rating is one judgement about one thing; it does not become a different
   * number because the writing beside it is private. When someone holds both
   * rows, letting them disagree would mean the profile and the community
   * average could report different scores for the same person and title.
   */
  // Unconditional, including a null. Guarding this on `score !== null` meant a
  // cleared rating updated the row you were looking at and left the number
  // intact on the other visibility row, so a legacy two-row user could clear a
  // score and still be carrying it.
  await match(supabase.from("takes").update({ score }), id, userId);

  await mirrorToLegacy(supabase, userId, id, { score, body, isPublic, input });
  return null;
}

/**
 * Project a title-scoped take back onto `user_ratings` and `watched_items`.
 *
 * Season and episode takes have no legacy mirror to keep — `season_reviews`
 * and `episode_ratings` are both empty and were never read by anything outside
 * their own components, which this change replaces.
 */
async function mirrorToLegacy(
  supabase: SupabaseClient,
  userId: string,
  id: TakeIdentity,
  data: { score: number | null; body: string; isPublic: boolean; input: SaveTakeInput },
): Promise<void> {
  if (id.scope !== "title") return;

  const base = {
    user_id: userId,
    item_id: id.itemId,
    item_type: id.itemType,
  };

  if (data.score !== null) {
    const { error } = await supabase
      .from("user_ratings")
      .upsert({ ...base, score: data.score }, { onConflict: "user_id,item_id,item_type" });
    if (error) console.error("mirror user_ratings:", error);
  } else {
    /**
     * Clearing has to reach here too.
     *
     * `rating_distribution` reads `user_ratings` with no predicate beyond the
     * title, so skipping this branch left a withdrawn score in the community
     * histogram permanently — the one number a rater cannot see and cannot
     * correct. The upsert above is not an update-in-place: there is no null to
     * write, so the row has to go.
     */
    const { error } = await supabase
      .from("user_ratings")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", id.itemId)
      .eq("item_type", id.itemType);
    if (error) console.error("mirror user_ratings clear:", error);
  }

  // Only the column matching this take's visibility is written, so a public
  // review never lands in the private diary or the reverse.
  const column = data.isPublic ? "public_review_text" : "review_text";
  const { error } = await supabase.from("watched_items").upsert(
    {
      ...base,
      item_name: data.input.itemName ?? "",
      ...(data.input.imageUrl ? { image_url: data.input.imageUrl } : {}),
      ...(data.input.genres?.length ? { genres: data.input.genres } : {}),
      [column]: data.body || null,
    },
    { onConflict: "user_id,item_id,item_type" },
  );
  if (error) console.error("mirror watched_items:", error);
}

/** Remove a take at one visibility, and clear its legacy mirror. */
export async function deleteTake(
  supabase: SupabaseClient,
  userId: string,
  id: TakeIdentity,
  isPublic: boolean,
): Promise<string | null> {
  const { error } = await match(
    supabase.from("takes").delete().eq("is_public", isPublic),
    id,
    userId,
  );
  if (error) {
    console.error("deleteTake:", error);
    return "Couldn't remove that.";
  }

  if (id.scope === "title") {
    const column = isPublic ? "public_review_text" : "review_text";
    await supabase
      .from("watched_items")
      .update({ [column]: null })
      .eq("user_id", userId)
      .eq("item_id", id.itemId)
      .eq("item_type", id.itemType);

    /**
     * The score has to go too — but only once nothing is left holding it.
     *
     * Clearing your only rating arrives here rather than in `saveTake`: an
     * empty body with a null score is routed straight to this function by the
     * PUT handler. Without this the row survived in `user_ratings`, which
     * `rating_distribution` reads with no predicate beyond the title, so a
     * withdrawn rating went on counting in the community average forever.
     *
     * The remaining-row check matters for the legacy two-row case: a user who
     * holds both a public and a private take at one title must not lose the
     * score by deleting one of them.
     */
    const { data: left } = await match(
      supabase.from("takes").select("is_public"),
      id,
      userId,
    );
    if (!left || left.length === 0) {
      await supabase
        .from("user_ratings")
        .delete()
        .eq("user_id", userId)
        .eq("item_id", id.itemId)
        .eq("item_type", id.itemType);
    }
  }
  return null;
}
