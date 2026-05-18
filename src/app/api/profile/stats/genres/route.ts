import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/profile/stats/genres?userId=...
 * Returns top genres for a user based on watched items.
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

  const { data: items, error } = await supabase
    .from("watched_items")
    .select("genres")
    .eq("user_id", userId)
    .eq("is_watched", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const genreCounts: Record<string, number> = {};
  items?.forEach((item) => {
    if (Array.isArray(item.genres)) {
      item.genres.forEach((genre: string) => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    }
  });

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, count]) => ({ genre, count }));

  return new Response(JSON.stringify({ data: topGenres }));
}
