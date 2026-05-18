import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/profile/stats/years?userId=...
 * Returns yearly activity for a user based on watched items.
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
    .select("watched_at")
    .eq("user_id", userId)
    .eq("is_watched", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  const yearCounts: Record<number, number> = {};
  items?.forEach((item) => {
    if (item.watched_at) {
      const year = new Date(item.watched_at).getFullYear();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    }
  });

  const yearlyActivity = Object.entries(yearCounts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year);

  return new Response(JSON.stringify({ data: yearlyActivity }));
}
