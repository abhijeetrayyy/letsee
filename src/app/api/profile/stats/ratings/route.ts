import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/profile/stats/ratings?userId=...
 * Returns rating distribution for a user.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
    });
  }

  const { data: ratings, error } = await supabase
    .from("user_ratings")
    .select("score")
    .eq("user_id", userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const ratingCounts: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) {
    ratingCounts[i] = 0;
  }

  ratings?.forEach((r) => {
    if (r.score >= 1 && r.score <= 10) {
      ratingCounts[r.score] = (ratingCounts[r.score] || 0) + 1;
    }
  });

  const distribution = Object.entries(ratingCounts)
    .map(([score, count]) => ({ score: Number(score), count }))
    .sort((a, b) => a.score - b.score);

  return new Response(JSON.stringify({ data: distribution }));
}
