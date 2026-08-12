import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getTasteMatches } from "@/utils/tasteMatch";

export const dynamic = "force-dynamic";

/**
 * GET /api/taste-matches?limit=3 — people who share your taste, ranked by
 * rarity-weighted title overlap, each with the evidence sentence.
 *
 * Distinct from /api/recommendations/collaborative, which also computes item
 * recommendations and bails early when the viewer has no genre vector. This
 * one only needs a single tracked title to produce a match, which is what the
 * onboarding flow relies on.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 5, 1), 20);
  const supabase = await createClient();
  const matches = await getTasteMatches(supabase, userId, limit);

  return jsonSuccess({
    matches: matches.map((m) => ({
      userId: m.userId,
      username: m.username,
      avatarUrl: m.avatarUrl,
      about: m.about,
      sharedCount: m.sharedCount,
      sharedTitles: m.sharedTitles,
      icebreaker: m.icebreaker,
    })),
  });
}
