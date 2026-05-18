import { createClient } from "@/utils/supabase/server";

/**
 * DELETE /api/watched-episodes/bulk-delete
 * Bulk delete multiple watched episodes for a show.
 * Request body: { showId, episodes: [{ season_number, episode_number }] }
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
    });
  }

  const { showId, episodes } = body;

  if (!showId || !episodes || !Array.isArray(episodes) || episodes.length === 0) {
    return new Response(
      JSON.stringify({ error: "showId and episodes array are required" }),
      { status: 400 }
    );
  }

  // Build conditions for bulk delete
  // We need to delete rows matching (user_id, show_id, AND (season_number, episode_number) pairs)
  // Since Supabase doesn't support tuple IN, we'll delete in batches
  const deleted = [];
  const errors = [];

  // Group episodes by season for more efficient queries
  const bySeason: Record<number, number[]> = {};
  for (const ep of episodes) {
    if (!bySeason[ep.season_number]) bySeason[ep.season_number] = [];
    bySeason[ep.season_number].push(ep.episode_number);
  }

  // Delete each season's episodes
  for (const [season, episodeNumbers] of Object.entries(bySeason)) {
    const { data, error } = await supabase
      .from("watched_episodes")
      .delete()
      .eq("user_id", user.id)
      .eq("show_id", showId)
      .eq("season_number", Number(season))
      .in("episode_number", episodeNumbers)
      .select();

    if (error) {
      errors.push({ season: Number(season), error: error.message });
    } else {
      deleted.push(...(data ?? []));
    }
  }

  if (errors.length > 0 && deleted.length === 0) {
    return new Response(
      JSON.stringify({ error: "Failed to delete episodes", details: errors }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      message: `Deleted ${deleted.length} episode(s)`,
      deletedCount: deleted.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  );
}
