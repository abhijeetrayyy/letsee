import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { loadParticipants, normalizeConstraints, resolveTonight } from "@/utils/tonight";
import { serializeParticipants } from "@/utils/tonightSession";

export const dynamic = "force-dynamic";

/** A room bigger than this stops being a decision and starts being a poll. */
const MAX_PARTICIPANTS = 8;

/**
 * POST /api/tonight — open a session and return the answer.
 *
 * Auth is required. A signed-out visitor has no watchlist, no services and no
 * follow graph, so every term in the score collapses to TMDB popularity —
 * which is a worse version of the trending row they already have.
 *
 * The caller is always a participant, whether or not they list themselves.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabase = await createClient();

  const { data: me } = await supabase
    .from("users")
    .select("watch_region")
    .eq("id", userId)
    .maybeSingle();

  const constraints = normalizeConstraints(body, me?.watch_region ?? "US");

  const requested = Array.isArray(body.participantIds)
    ? (body.participantIds as unknown[]).map(String)
    : [];
  const participantIds = [...new Set([userId, ...requested])].slice(0, MAX_PARTICIPANTS);

  // Only people who follow the caller, or whom the caller follows, can be
  // pulled into a room. Without this, anyone could enumerate a stranger's
  // watchlist by opening a session against their id and reading the reasons.
  const others = participantIds.filter((id) => id !== userId);
  if (others.length > 0) {
    const { data: connections } = await supabase
      .from("user_connections")
      .select("follower_id, followed_id")
      .or(`follower_id.eq.${userId},followed_id.eq.${userId}`);

    const connected = new Set<string>();
    for (const c of connections ?? []) {
      connected.add(c.follower_id === userId ? (c.followed_id as string) : (c.follower_id as string));
    }
    const stranger = others.find((id) => !connected.has(id));
    if (stranger) return jsonError("You can only start a session with people you follow", 403);
  }

  const { data: session, error: sessionError } = await supabase
    .from("watch_sessions")
    .insert({
      created_by: userId,
      region: constraints.region,
      max_runtime: constraints.maxRuntime,
      media_type: constraints.mediaType,
      moods: constraints.moods,
      allow_rewatch: constraints.allowRewatch,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    console.error("tonight create session:", sessionError);
    return jsonError("Failed to start a session", 500);
  }

  const sessionId = Number(session.id);

  const { error: participantError } = await supabase
    .from("watch_session_participants")
    .insert(participantIds.map((id) => ({ session_id: sessionId, user_id: id })));

  if (participantError) {
    console.error("tonight add participants:", participantError);
    return jsonError("Failed to start a session", 500);
  }

  const participants = await loadParticipants(supabase, participantIds);
  const { pick, alternates } = await resolveTonight(
    supabase,
    participants,
    constraints,
    new Set(),
  );

  return jsonSuccess({
    sessionId,
    constraints,
    participants: serializeParticipants(participants),
    pick,
    alternates,
  });
}
