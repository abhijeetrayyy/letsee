import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/profile/tv-calendar?userId=...&year=2024&month=3
 * Returns watched episodes grouped by date for calendar view.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!userId) {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
    });
  }

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const viewerId = viewer?.id ?? null;

  // Check visibility
  const { data: profile } = await supabase
    .from("users")
    .select("visibility")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
    });
  }

  const visibility = String(profile.visibility ?? "public").toLowerCase().trim();
  let canView = visibility === "public" || (viewerId && viewerId === userId);

  if (!canView && viewerId && visibility === "followers") {
    const { data: connection } = await supabase
      .from("user_connections")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("followed_id", userId)
      .maybeSingle();
    if (connection) canView = true;
  }

  if (!canView) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });
  }

  // Build date filter
  let query = supabase
    .from("watched_episodes")
    .select("show_id, season_number, episode_number, watched_at")
    .eq("user_id", userId)
    .order("watched_at", { ascending: false });

  if (year) {
    const yearStart = new Date(Number(year), 0, 1).toISOString();
    const yearEnd = new Date(Number(year), 11, 31, 23, 59, 59).toISOString();
    query = query.gte("watched_at", yearStart).lte("watched_at", yearEnd);
  }

  if (year && month) {
    const monthStart = new Date(Number(year), Number(month) - 1, 1).toISOString();
    const monthEnd = new Date(Number(year), Number(month), 0, 23, 59, 59).toISOString();
    query = query.gte("watched_at", monthStart).lte("watched_at", monthEnd);
  }

  const { data: episodes, error } = await query.limit(500);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  // Group by date
  const byDate: Record<string, Array<{ show_id: string; season_number: number; episode_number: number; watched_at: string }>> = {};

  for (const ep of episodes ?? []) {
    const dateKey = new Date(ep.watched_at).toISOString().split("T")[0];
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(ep);
  }

  // Get unique show IDs
  const showIds = [...new Set((episodes ?? []).map((ep) => ep.show_id))];

  // Fetch show names from watched_items
  const { data: shows } = await supabase
    .from("watched_items")
    .select("item_id, item_name, image_url")
    .eq("user_id", userId)
    .eq("item_type", "tv")
    .in("item_id", showIds);

  const showMap: Record<string, { name: string; image_url: string | null }> = {};
  for (const show of shows ?? []) {
    showMap[show.item_id] = { name: show.item_name, image_url: show.image_url };
  }

  // Enrich episodes with show info
  const enrichedByDate: Record<string, Array<any>> = {};
  for (const [date, eps] of Object.entries(byDate)) {
    enrichedByDate[date] = eps.map((ep) => ({
      ...ep,
      show_name: showMap[ep.show_id]?.name ?? "Unknown",
      show_image: showMap[ep.show_id]?.image_url ?? null,
    }));
  }

  return new Response(
    JSON.stringify({
      data: enrichedByDate,
      totalEpisodes: episodes?.length ?? 0,
    })
  );
}
