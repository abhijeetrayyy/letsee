import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The words someone has actually published on a title — their `takes` row on
 * the shelf — keyed `type:id`.
 *
 * Review pages and a profile's Reviews list are found through
 * `watched_items.public_review_text`, a copy `takes` keeps for the old
 * readers (and for the review's address, which is that row's id). A copy can
 * go stale: the owner's Interstellar still carried "probe: kept private" in it
 * long after the take itself became private with no words, and the review
 * page published it. So the copy now only says where to look; what is shown,
 * and whether anything is, comes from here. RLS (`takes_public_read`) applies
 * as usual, so a viewer who may not read the take gets nothing.
 */
export async function publishedReviewText(
  supabase: SupabaseClient,
  userId: string,
  items: { item_id: string; item_type: string }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(items.map((i) => String(i.item_id)))];
  if (!ids.length) return out;
  const { data } = await supabase
    .from("takes")
    .select("item_id, item_type, body, updated_at")
    .eq("user_id", userId)
    .in("item_id", ids)
    .eq("scope", "title")
    .eq("visibility", "shelf")
    .not("body", "is", null)
    .order("updated_at", { ascending: true });
  // Ascending, so the newest row for a title wins.
  for (const r of (data ?? []) as { item_id: string; item_type: string; body: string | null }[]) {
    const body = r.body?.trim();
    if (body) out.set(`${r.item_type}:${r.item_id}`, body);
  }
  return out;
}
