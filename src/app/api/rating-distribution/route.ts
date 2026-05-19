import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/rating-distribution?itemId=123&itemType=movie
// Returns a histogram of all user ratings for this item (1-10)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");
  const itemType = searchParams.get("itemType");

  if (!itemId || !itemType) {
    return NextResponse.json({ error: "itemId and itemType required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: ratings, error } = await supabase
    .from("user_ratings")
    .select("score")
    .eq("item_id", itemId)
    .eq("item_type", itemType);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build histogram (1-10)
  const histogram: Record<number, number> = {};
  for (let i = 1; i <= 10; i++) histogram[i] = 0;
  for (const r of ratings ?? []) {
    if (r.score >= 1 && r.score <= 10) histogram[r.score]++;
  }

  const total = (ratings ?? []).length;
  const avg = total > 0
    ? (ratings ?? []).reduce((sum, r) => sum + r.score, 0) / total
    : 0;

  return NextResponse.json({
    total,
    average: Math.round(avg * 10) / 10,
    histogram,
    distribution: Object.entries(histogram).map(([score, count]) => ({
      score: Number(score),
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    })),
  });
}
