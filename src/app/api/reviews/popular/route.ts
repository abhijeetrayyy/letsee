import { NextRequest } from "next/server";
import { createAnonClient } from "@/utils/supabase/anon";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/**
 * GET /api/reviews/popular?days=7&limit=6 — recent writing, one piece per title.
 *
 * The only surface where a review can be found by someone who wasn't already
 * on the title page it belongs to. Without it, writing well here has no
 * distribution at all, which is the whole reason nobody bothers.
 *
 * **It used to rank by reaction count, and that was working against the
 * product.** The first writing anyone reads sets the standard they think they
 * have to meet, so ranking by likes means every newcomer's first impression is
 * the most polished thing anybody has ever written here — and their own draft
 * dies against it. It also puts a visible score on people's writing, which is
 * the fastest way to make writing feel like a performance being marked.
 *
 * So: **coverage, not competition.** One piece per title, newest first. Nobody
 * is ranked, no counts are shown, and a first-timer's three sentences sit in
 * the same row as anyone else's paragraph — which is the honest picture of
 * what this place is, and the one that makes the next person willing to type.
 *
 * Public writing only, so the response is identical for every viewer and can
 * genuinely be shared-cached.
 */
export async function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days")) || 7, 1), 90);
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 6, 1), 20);

  /**
   * Read as `anon`, so the cache header two hundred lines below is true.
   *
   * The comment above says this response "is identical for every viewer and
   * can genuinely be shared-cached", and it was *nearly* so: the queries filter
   * on `is_public` and re-check the author's visibility in JS. But the client
   * was the cookie-reading one, and RLS on `takes` and `watched_items` is
   * `auth.uid() = user_id OR profile_visible_to_viewer(user_id)` — so a
   * signed-in reader's `limit(limit * 8)` window was drawn from a *wider* set
   * of rows than a stranger's, including their own private takes and those of
   * accounts they follow. The public-only filter then discarded them, which
   * means two viewers could get different results from the same query: not by
   * leaking anything, but by spending their window on rows that were about to
   * be thrown away.
   *
   * Reading as `anon` makes the row set identical for everybody, which is what
   * a shared cache requires and, incidentally, what the pagination window
   * needed to be correct in the first place.
   */
  const supabase = createAnonClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  // Read wider than `limit`, because collapsing to one per title discards rows.
  const [takesRes, legacyRes] = await Promise.all([
    supabase
      .from("takes")
      .select("user_id, item_id, item_type, body, updated_at, users!inner(username, avatar_url, visibility)")
      .eq("is_public", true)
      .eq("scope", "title")
      .not("body", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(limit * 8),
    supabase
      .from("watched_items")
      .select("id, user_id, item_id, item_type, item_name, image_url, public_review_text, watched_at, users!inner(username, avatar_url, visibility)")
      .not("public_review_text", "is", null)
      .gte("watched_at", since)
      .order("watched_at", { ascending: false })
      .limit(limit * 8),
  ]);

  type Author = { username?: string; avatar_url?: string | null; visibility?: string | null };
  // Null visibility means public — the bare `= 'public'` comparison drops every
  // account that predates the column, which migrations 018 and 062 both
  // document and which 066 was written to avoid repeating.
  const isPublicProfile = (a: Author | null) =>
    !a?.visibility || String(a.visibility).trim().toLowerCase() === "public";

  type Row = {
    id: string | number;
    username: string;
    avatarUrl: string | null;
    reviewText: string;
    itemId: string | null;
    itemType: "movie" | "tv";
    itemName: string;
    imageUrl: string | null;
    at: string;
  };

  const rows: Row[] = [];

  for (const r of (takesRes.data ?? []) as Record<string, unknown>[]) {
    const author = r.users as unknown as Author;
    if (!isPublicProfile(author)) continue;
    rows.push({
      id: `take:${r.user_id}:${r.item_type}:${r.item_id}`,
      username: author?.username ?? "someone",
      avatarUrl: author?.avatar_url ?? null,
      reviewText: String(r.body ?? ""),
      itemId: r.item_id ? String(r.item_id) : null,
      itemType: r.item_type === "tv" ? "tv" : "movie",
      // `takes` stores no title or poster. Filled in by the backfill below
      // rather than shipped blank.
      itemName: "",
      imageUrl: null,
      at: String(r.updated_at ?? ""),
    });
  }

  for (const r of (legacyRes.data ?? []) as Record<string, unknown>[]) {
    const author = r.users as unknown as Author;
    if (!isPublicProfile(author)) continue;
    rows.push({
      id: Number(r.id),
      username: author?.username ?? "someone",
      avatarUrl: author?.avatar_url ?? null,
      reviewText: String(r.public_review_text ?? ""),
      itemId: r.item_id ? String(r.item_id) : null,
      itemType: r.item_type === "tv" ? "tv" : "movie",
      itemName: String(r.item_name ?? ""),
      imageUrl: (r.image_url as string | null) ?? null,
      at: String(r.watched_at ?? ""),
    });
  }

  /**
   * Titles for the rows that have none.
   *
   * `takes` is keyed on a TMDB id and stores no name or poster, and this route
   * shipped `itemName: ""` with a comment saying the client would fall back to
   * an id link. It did — and that one missing string produced three visible
   * defects at once: a nameless URL, the `/no-photo.webp` placeholder, and an
   * empty `alt` on the card.
   *
   * Looked up by `item_type:item_id`, deliberately not by `user_id:item_id`
   * the way the following-feed route does it. A film's name is not a fact
   * about the person who logged it, and keying on the author leaves a take by
   * someone who never shelved the title nameless — which is the case that
   * produced this bug.
   *
   * `user_media_status` first, since that is what everyone writes when they
   * track anything; `watched_items` only for whatever is still missing, so the
   * common case costs one query and the rare one two.
   */
  const missing = rows.filter((r) => !r.itemName && r.itemId);
  if (missing.length > 0) {
    const byKey = new Map<string, { name: string; image: string | null }>();

    const remember = (list: Record<string, unknown>[] | null) => {
      for (const t of list ?? []) {
        const name = String(t.item_name ?? "").trim();
        if (!name) continue;
        const key = `${t.item_type}:${t.item_id}`;
        if (!byKey.has(key)) byKey.set(key, { name, image: (t.image_url as string | null) ?? null });
      }
    };

    const { data: statusRows } = await supabase
      .from("user_media_status")
      .select("item_id, item_type, item_name, image_url")
      .in("item_id", [...new Set(missing.map((r) => r.itemId as string))])
      .not("item_name", "is", null);
    remember(statusRows as Record<string, unknown>[] | null);

    const stillMissing = missing.filter((r) => !byKey.has(`${r.itemType}:${r.itemId}`));
    if (stillMissing.length > 0) {
      const { data: watchedRows } = await supabase
        .from("watched_items")
        .select("item_id, item_type, item_name, image_url")
        .in("item_id", [...new Set(stillMissing.map((r) => r.itemId as string))])
        .not("item_name", "is", null);
      remember(watchedRows as Record<string, unknown>[] | null);
    }

    for (const r of missing) {
      const hit = byKey.get(`${r.itemType}:${r.itemId}`);
      if (!hit) continue;
      r.itemName = hit.name;
      r.imageUrl = r.imageUrl ?? hit.image;
    }
  }

  // One per title, and one per author — so a single prolific week cannot fill
  // the row, and neither can a single film.
  rows.sort((a, b) => b.at.localeCompare(a.at));
  const seenTitle = new Set<string>();
  const seenAuthor = new Set<string>();
  const reviews = rows
    .filter((r) => {
      if (!r.reviewText.trim()) return false;
      const t = `${r.itemType}:${r.itemId}`;
      if (seenTitle.has(t) || seenAuthor.has(r.username)) return false;
      seenTitle.add(t);
      seenAuthor.add(r.username);
      return true;
    })
    .slice(0, limit)
    // The consumer still reads `reactionCount`; it is deliberately always 0
    // now, and the component no longer renders it.
    .map(({ at: _at, ...rest }) => ({ ...rest, reactionCount: 0 }));

  /**
   * The empty answer is cached too, just for less long.
   *
   * `maxAge: 0` here was the expensive branch and it looked like the safe one.
   * "No public reviews in the last seven days" is the *normal* state of a
   * young site, and this runs on the home page — so the one response nobody
   * was caching was the one almost every visitor got, and each of those hits
   * paid for two full-table-scoped queries to be told there is nothing yet.
   *
   * Five minutes rather than fifteen: an empty shelf is the case where being
   * quick to notice a change actually matters, because the change is somebody
   * publishing the first review and immediately looking for it on the home
   * page.
   */
  if (reviews.length === 0) return jsonSuccess({ reviews: [] }, { maxAge: 300 });

  return jsonSuccess({ reviews }, { maxAge: 900 });
}
