import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/utils/apiResponse";
import { getAuthUserId } from "@/utils/apiAuth";
import { ensureShowInMediaStatus, autoTransitionStatus } from "@/utils/tvMediaStatus";

import { guard } from "@/lib/limits/guard";
export async function POST(req: NextRequest) {
  const limited = await guard("write", req);
  if (limited) return limited;
  const supabase = await createClient();
  const userId = await getAuthUserId();
  if (!userId) {
    return jsonError("User isn't logged in", 401);
  }

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
  }

  // Unmark: one delete per season (pairs can't be matched in one filter), so
  // Finished — and anything else that marked a batch — can be undone exactly.
  const bySeason = new Map<number, number[]>();
  for (const e of uniqueEpisodes) bySeason.set(e.season_number, [...(bySeason.get(e.season_number) ?? []), e.episode_number]);
  for (const [season, eps] of bySeason) {
    const { error } = await supabase
      .from("watched_episodes")
      .delete()
      .eq("user_id", userId)
      .eq("show_id", showId)
      .eq("season_number", season)
      .in("episode_number", eps);
    if (error) {
      console.error("bulk-unmark-episodes delete:", error);
      return jsonError("Failed to unmark episodes", 500);
    }
  }
  await autoTransitionStatus(supabase, userId, showId);
  return NextResponse.json({ action: "unmarked", count: uniqueEpisodes.length }, { status: 200 });
}
