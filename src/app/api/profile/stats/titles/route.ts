import { createClient } from "@/utils/supabase/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/stats/titles?userId=…&source=you|crowd&bucket=8&type=movie
 *                              &genre=Drama&decade=1990&limit=30&offset=0
 *
 * The titles behind one bar.
 *
 * A chart you cannot open is a chart people look at once. Every bar in the
 * Stats section — either rating scale, a genre, a decade — resolves through
 * this one route, so there is a single query to keep correct and a single
 * place where the visibility rules apply.
 *
 * Bounds are applied here *and* in `profile_taste_titles` (089). Not
 * belt-and-braces: this route can be called directly, so the SQL cannot rely
 * on the caller having clamped anything, and clamping here just means a silly
 * `limit` returns 100 rows rather than an error.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return jsonError("userId is required", 400);
  }

  const boundedInt = (raw: string | null, min: number, max: number): number | null => {
    if (raw === null || raw === "") return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(Math.max(Math.trunc(parsed), min), max);
  };

  const source = searchParams.get("source") === "crowd" ? "crowd" : "you";
  const itemTypeRaw = searchParams.get("type");
  const itemType = itemTypeRaw === "movie" || itemTypeRaw === "tv" ? itemTypeRaw : null;
  const limit = boundedInt(searchParams.get("limit"), 1, 100) ?? 30;
  const offset = boundedInt(searchParams.get("offset"), 0, 100_000) ?? 0;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("profile_taste_titles", {
    p_user_id: userId,
    p_source: source,
    p_bucket: boundedInt(searchParams.get("bucket"), 1, 10),
    p_item_type: itemType,
    p_genre: searchParams.get("genre")?.slice(0, 60) || null,
    p_decade: boundedInt(searchParams.get("decade"), 1870, 2100),
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("profile_taste_titles:", error.message);
    return jsonError("Couldn't load titles", 500);
  }

  const rows = (data ?? []) as { total_count?: number | string }[];

  // total_count is a window function repeated on every row. Lift it out once
  // so the client gets a paging total instead of the same number thirty times.
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

  return jsonSuccess({
    data: rows.map(({ total_count: _ignored, ...row }) => row),
    total,
    hasMore: offset + rows.length < total,
  });
}
