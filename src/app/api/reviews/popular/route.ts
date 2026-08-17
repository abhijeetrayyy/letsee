import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
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

  const supabase = await createClient();
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
      // `takes` stores no title or poster; the client falls back to the id link.
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

  if (reviews.length === 0) return jsonSuccess({ reviews: [] }, { maxAge: 0 });

  return jsonSuccess({ reviews }, { maxAge: 900 });
}
