import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { NextResponse } from "next/server";
import { jsonError } from "@/utils/apiResponse";
import { getPairwiseCompatibility } from "@/utils/tasteMatch";
import { buildGenreVector, cosineSimilarity } from "@/utils/genreVector";

export const dynamic = "force-dynamic";

/**
 * GET /api/compatibility?userId=… — taste overlap between the viewer and
 * another user.
 *
 * Two numbers, deliberately:
 *  - `sharedTitles` / `icebreaker` is the real signal (rarity-weighted title
 *    overlap). This is what should be shown to a human.
 *  - `genreSimilarity` is the soft 0–100 "taste overlap" figure the profile
 *    donut renders. It's a blunt instrument — with ~20 genres most active
 *    users land high — so it reads as flavour, not evidence.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const otherUserId = searchParams.get("userId");
  if (!otherUserId) return jsonError("userId is required", 400);

  const supabase = await createClient();
  const currentUserId = await getAuthUserId();
  if (!currentUserId) return jsonError("Not authenticated", 401);

  try {
    const [overlap, myWatched, myFavs, otherWatched, otherFavs] = await Promise.all([
      getPairwiseCompatibility(supabase, currentUserId, otherUserId),
      supabase.from("watched_items").select("genres").eq("user_id", currentUserId),
      supabase.from("favorite_items").select("genres").eq("user_id", currentUserId),
      supabase.from("watched_items").select("genres").eq("user_id", otherUserId),
      supabase.from("favorite_items").select("genres").eq("user_id", otherUserId),
    ]);

    const genreSim = cosineSimilarity(
      buildGenreVector([...(myWatched.data ?? []), ...(myFavs.data ?? [])]),
      buildGenreVector([...(otherWatched.data ?? []), ...(otherFavs.data ?? [])]),
    );

    return NextResponse.json(
      {
        // Headline evidence
        sharedTitles: overlap.sharedTitles,
        sharedCount: overlap.sharedCount,
        icebreaker: overlap.icebreaker,
        /** Ranking signal — not meaningful as a percentage. */
        overlapScore: overlap.score,

        // Display figure for the existing compatibility ring
        compatibility: Math.round(Math.min(1, Math.max(0, genreSim)) * 100),
        genreSimilarity: Math.round(genreSim * 100),
        genreMatchLevel: genreSim > 0.5 ? "high" : genreSim > 0.2 ? "medium" : "low",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    console.error("Compatibility error:", err);
    return jsonError("Failed to compute compatibility", 500);
  }
}
