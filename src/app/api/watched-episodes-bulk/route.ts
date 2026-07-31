import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { ensureShowInMediaStatus, autoTransitionStatus } from "@/utils/tvMediaStatus";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData?.user) {
    return jsonError("User isn't logged in", 401);
  }
  const userId = userData.user.id;

  let body: {
    showId?: string;
    episodes?: { season_number: number; episode_number: number }[];
    action?: "mark" | "unmark"; // Default to mark
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const showId = body.showId;
  const episodes = body.episodes;
  const action = body.action || "mark";

  if (!showId || !Array.isArray(episodes) || episodes.length === 0) {
    return jsonError("showId and a non-empty episodes array are required", 400);
  }

  // Deduplicate
  const uniqueEpisodes = Array.from(
    new Set(episodes.map((e) => `${e.season_number}-${e.episode_number}`)),
  ).map((s) => {
    const [sn, en] = s.split("-").map(Number);
    return { season_number: sn, episode_number: en };
  });

  if (action === "mark") {
    // Bulk insert
    // We use upsert-like behavior: check existing or just ignore conflict if constraint exists?
    // Supabase .insert() with ignoreDuplicates: true works for unique constraints.
    // Assuming unique constraint on (user_id, show_id, season_number, episode_number)

    const rows = uniqueEpisodes.map((e) => ({
      user_id: userId,
      show_id: showId,
      season_number: e.season_number,
      episode_number: e.episode_number,
    }));

    const { error } = await supabase
      .from("watched_episodes")
      .upsert(rows, {
        onConflict: "user_id,show_id,season_number,episode_number",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error("bulk-mark-episodes insert:", error);
      return jsonError("Failed to mark episodes", 500);
    }

    await ensureShowInMediaStatus(supabase, userId, showId);
    await autoTransitionStatus(supabase, userId, showId);

    return NextResponse.json(
      { action: "marked", count: uniqueEpisodes.length },
      { status: 200 },
    );
  } else {
    // Unmark (delete)
    // Supabase doesn't support bulk delete with compound keys efficiently in one query clause strictly?
    // We can use an `or` filter with structure like `and(season_number.eq.X,episode_number.eq.Y),...`
    // Or just loop. Since standard bulk might be ~20 items, looping isn't terrible but not ideal.
    // Better: Filter by show_id and user_id, and use .in() for seasons? No, pairs.
    // The most robust way for arbitrary pairs is a loop or RPC.
    // For "Mark Season", we can delete by season_number.

    // For simplicity in this iteration, we loop deletions or use a custom filter string.
    // Let's assume the use case is small bulk (previous episodes) or whole season.

    // Note: User request currently focuses on "Mark all previous" (insert).
    // "Unmark" isn't explicitly requested in Phase 3.2.
    // I'll leave unmark unimplemented for now or basic loop.

    return jsonError("Unmark action not fully implemented yet", 501);
  }
}
