/**
 * The signed-in viewer's own titles, for the local search index.
 *
 * This is the half that makes "a misspelling of a title in *your* library still
 * surfaces it" true — the popular slice cannot know about the obscure film you
 * logged last year. That other half, `/api/search/catalog`, stays a Vercel
 * route on purpose: it is TMDB-derived, identical for everybody, and cached, so
 * one invocation serves every visitor. This half is the opposite in every
 * respect — different for each viewer, uncacheable, and up to 5,000 rows — so
 * it was the one paying a function invocation *and* the full origin transfer,
 * per person, every time the search modal was first opened.
 *
 * Three rules here are load-bearing rather than stylistic:
 *
 * 1. **An explicit column allowlist, never `select("*")`.** `watched_items`
 *    carries `review_text`, the private diary. Selecting it into a payload that
 *    lands in browser memory would turn a search feature into a data-exposure
 *    change. (It would also fail: 076 revoked SELECT on that column. Both
 *    reasons are good ones.)
 * 2. **Explicit `.range()` paging.** PostgREST caps unbounded selects (commonly
 *    at 1000 rows) without erroring, so a large library would silently truncate
 *    and present as "fuzzy search just can't find my older films".
 * 3. **The row budget stays.** Five thousand is the ceiling on what gets held
 *    in memory and matched on every keystroke.
 */

import { supabase } from "@/utils/supabase/client";
import { normalizeQuery, MAX_INDEX_ROWS, type IndexRow } from "@/utils/searchIndex";

/** PostgREST's usual ceiling; ask for exactly this and keep going while it's full. */
const PAGE = 1000;

type Row = {
  item_id: string;
  item_name: string | null;
  item_type: string | null;
  image_url: string | null;
};

async function readAll(
  run: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  budget: number,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; out.length < budget; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

const COLUMNS = "item_id, item_name, item_type, image_url";

export async function fetchLibraryIndexRows(userId: string): Promise<IndexRow[]> {
  const listIds = await supabase.from("user_lists").select("id").eq("user_id", userId);
  const ids = (listIds.data ?? []).map((l: { id: number }) => l.id);

  const [status, watched, favorites, listItems] = await Promise.all([
    readAll(
      (f, t) =>
        supabase
          .from("user_media_status")
          .select(COLUMNS)
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .range(f, t),
      MAX_INDEX_ROWS,
    ),
    readAll(
      (f, t) =>
        supabase
          .from("watched_items")
          .select(COLUMNS)
          .eq("user_id", userId)
          .order("watched_at", { ascending: false })
          .range(f, t),
      MAX_INDEX_ROWS,
    ),
    readAll(
      (f, t) =>
        supabase
          .from("favorite_items")
          .select(COLUMNS)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(f, t),
      MAX_INDEX_ROWS,
    ),
    ids.length === 0
      ? Promise.resolve([] as Row[])
      : readAll(
          (f, t) =>
            supabase
              .from("user_list_items")
              .select(COLUMNS)
              .in("list_id", ids)
              .order("created_at", { ascending: false })
              .range(f, t),
          MAX_INDEX_ROWS,
        ),
  ]);

  // `watched_items` is not redundant with `user_media_status`: the profile page
  // documents the legacy mirror as carrying rows the unified table does not.
  const rows: IndexRow[] = [];
  const seen = new Set<string>();
  for (const r of [...status, ...favorites, ...watched, ...listItems]) {
    const type = r.item_type === "tv" ? "tv" : "movie";
    const name = (r.item_name ?? "").trim();
    const k = `${type}:${r.item_id}`;
    if (!name || seen.has(k)) continue;
    seen.add(k);
    // `y` is null for every library row — none of these four tables stores a
    // release year. Only the popular slice can carry one.
    rows.push({ k, n: name, s: normalizeQuery(name), t: type, y: null, p: r.image_url ?? null, lib: true });
    if (rows.length >= MAX_INDEX_ROWS) break;
  }

  return rows;
}
