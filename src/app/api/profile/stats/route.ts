import { createClient } from "@/utils/supabase/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/**
 * GET /api/profile/stats?userId=...
 *
 * Everything the Stats section draws, in one call.
 *
 * ── What this replaced ─────────────────────────────────────────────────────
 * Three routes — /stats/ratings, /stats/genres, /stats/years — each of which
 * ran an unbounded `select` and did the counting in JavaScript. That was slow,
 * and past a certain library size it was also *wrong*: PostgREST caps a result
 * set at 1000 rows by default, so a user with more than 1000 ratings or 1000
 * watched titles got a silently truncated chart with no error to notice.
 *
 * `profile_taste_stats` (089) aggregates in SQL and returns roughly sixty rows
 * of JSON no matter how large the library is, which puts the cap out of reach
 * rather than merely further away.
 *
 * ── Why there is no canViewProfile call here ───────────────────────────────
 * The RPC is the gate. It runs `profile_visible_to_viewer` (081) internally,
 * which already covers deleted accounts, private and followers-only profiles,
 * and blocks in both directions — and returns NULL rather than data when any
 * of those apply. Checking again in TypeScript would cost a second round trip
 * to reach the same answer, and would be a second place for the rule to drift.
 *
 * NULL becomes a flat 404 on purpose. Distinguishing "no such profile" from
 * "you may not see this one" tells an unauthenticated caller which private
 * accounts exist.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return jsonError("userId is required", 400);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("profile_taste_stats", {
    p_user_id: userId,
  });

  if (error) {
    console.error("profile_taste_stats:", error.message);
    return jsonError("Couldn't load stats", 500);
  }

  if (!data) {
    return jsonError("Stats are not available for this profile", 404);
  }

  // private, no-store — the payload depends on who is asking (the owner sees
  // scores a visitor to the same profile may not), so a shared cache has no
  // key it could safely use.
  return jsonSuccess({ data });
}
