import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { loadSession } from "@/utils/tonightSession";
import { autoTransitionStatus, ensureShowInMediaStatus } from "@/utils/tvMediaStatus";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/tonight/[id]/decide — this is the one we're watching.
 *
 * Closes the loop the whole feature exists for: the diary entry is a byproduct
 * of the decision rather than a chore afterwards.
 *
 * **Only the caller's own status is written.** The other participants were
 * added to the room by whoever opened it — they never accepted anything — so
 * silently writing to their library would be mutating someone else's data on a
 * stranger's button press. The verdict is recorded on the session instead, and
 * each participant's own client can offer to log it. Applying it for everyone
 * needs a consent step first; see SURPASSING_LETTERBOXD.md.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const { id } = await ctx.params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) return jsonError("Invalid session id", 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const itemId = body.itemId != null ? String(body.itemId) : null;
  const itemType = body.itemType === "tv" ? "tv" : "movie";
  if (!itemId) return jsonError("itemId is required", 400);

  const itemName = typeof body.itemName === "string" ? body.itemName : "";
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl : null;
  const genres = Array.isArray(body.genres) ? (body.genres as unknown[]).map(String) : [];
  const runtime = Number(body.runtime);

  // An episode pick carries the exact episode the room agreed on, so
  // committing to it should log *that*, not just "still watching this show".
  const seasonNumber = Number(body.seasonNumber);
  const episodeNumber = Number(body.episodeNumber);
  const isEpisode =
    itemType === "tv" &&
    Number.isInteger(seasonNumber) &&
    seasonNumber >= 0 &&
    Number.isInteger(episodeNumber) &&
    episodeNumber >= 1;

  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return jsonError("Session not found", 404);

  const me = session.participants.find((p) => p.userId === userId);
  if (!me) return jsonError("Session not found", 404);

  // Stamp the verdict. Only the creator can write the session row (RLS), so
  // for everyone else this is a no-op and the status write below is the part
  // that matters.
  if (session.createdBy === userId) {
    const { error } = await supabase
      .from("watch_sessions")
      .update({
        decided_item_id: itemId,
        decided_item_type: itemType,
        decided_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (error) console.error("tonight decide stamp:", error);
  }

  if (isEpisode) {
    // Reuses the same two helpers /api/watched-episode does, so an episode
    // logged from Tonight is indistinguishable from one ticked off on the
    // season page — including the status transition to 'watched' when this
    // was the last one.
    await ensureShowInMediaStatus(supabase, userId, itemId);

    const { error } = await supabase.from("watched_episodes").upsert(
      {
        user_id: userId,
        show_id: itemId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        watched_at: new Date().toISOString(),
      },
      { onConflict: "user_id,show_id,season_number,episode_number", ignoreDuplicates: true },
    );

    if (error) {
      console.error("tonight decide episode:", error);
      return jsonError("Failed to save that", 500);
    }

    await autoTransitionStatus(supabase, userId, itemId);

    // Recounted by 069's user_media_status triggers, inside the write above.
  }

  // A rewatch must not demote an existing 'watched' row — that would pull the
  // title out of their Films grid for the duration of the rewatch.
  const existing = me.statusByItem.get(`${itemType}:${itemId}`);
  if (!isEpisode && existing !== "watched") {
    const { error } = await supabase.from("user_media_status").upsert(
      {
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        item_name: itemName,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        genres,
        status: "watching",
        // `runtime_minutes` was dropped from user_media_status by 054. Writing it
        // made every commit-to-a-film-with-a-known-runtime fail on PGRST204 and
        // return "Failed to save that" — so the one action Tonight exists to
        // close, actually starting the thing you picked, wrote no status at all.
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,item_id,item_type" },
    );

    if (error) {
      console.error("tonight decide status:", error);
      return jsonError("Failed to save that", 500);
    }

    // Recounted by 069's user_media_status triggers, inside the write above.
  }

  // An explicit 'in' vote, so the session record shows what was chosen over
  // what, not just what was rejected.
  await supabase.from("watch_session_votes").upsert(
    { session_id: sessionId, user_id: userId, item_id: itemId, item_type: itemType, vote: "in" },
    { onConflict: "session_id,user_id,item_id" },
  );

  return jsonSuccess({
    ok: true,
    decided: { itemId, itemType, ...(isEpisode ? { seasonNumber, episodeNumber } : {}) },
    /** Participants whose own libraries were deliberately left untouched. */
    othersNotified: session.participants.filter((p) => p.userId !== userId).length,
  });
}
