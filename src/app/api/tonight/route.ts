import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { loadParticipants, normalizeConstraints, resolveTonight } from "@/utils/tonight";
import { serializeParticipants } from "@/utils/tonightSession";
import { strangersIn } from "@/lib/people/tonight";
import { roomedAmong } from "@/utils/tonightRooms";

import { guard } from "@/lib/limits/guard";
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
  const limited = await guard("write", req);
  if (limited) return limited;
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

  // A group room's session (migration 107): the caller must be an active
  // member, and the other members count as connected — being in the same
  // club is the connection, whether or not they follow one another.
  let clubId: number | null = null;
  const clubMembers = new Set<string>();
  const clubSlug = typeof body.clubSlug === "string" ? body.clubSlug.trim().slice(0, 80) : "";
  if (clubSlug) {
    const { data: club } = await supabase.from("clubs").select("id, join_policy").eq("slug", clubSlug).maybeSingle();
    if (!club) return jsonError("That group doesn't exist", 404);
    const { data: members } = await supabase.from("club_members").select("user_id").eq("club_id", club.id).eq("status", "active");
    const active = new Set((members ?? []).map((m) => m.user_id as string));
    if (!active.has(userId)) return jsonError("Join the group to decide with it", 403);
    clubId = Number(club.id);
    // Being in a group counts as a connection only when the group admits its
    // members (join by request). Anyone can join an open group, so there it
    // would let a stranger read a member's watchlist through the reasons.
    if (club.join_policy === "request") for (const id of active) clubMembers.add(id);
  }

  // Never with someone either side has blocked, group or not.
  const others = participantIds.filter((id) => id !== userId);
  // Both directions, through `is_blocked`: a read of `user_blocks` sees only
  // the blocks the caller made, so someone who had blocked them passed.
  if (others.length > 0) {
    const blocked = await Promise.all(
      others.map((id) => supabase.rpc("is_blocked", { p_viewer_id: userId, p_profile_id: id }).then(({ data, error }) => !!error || data === true)),
    );
    if (blocked.some(Boolean)) return jsonError("You can only decide with people you follow or share a room with", 403);
  }

  // Only people who follow the caller, or whom the caller follows, can be
  // pulled into a room. Without this, anyone could enumerate a stranger's
  // watchlist by opening a session against their id and reading the reasons.
  if (strangersIn(participantIds, userId, new Set(), clubMembers).length > 0) {
    const { data: connections } = await supabase
      .from("user_connections")
      .select("follower_id, followed_id")
      .or(`follower_id.eq.${userId},followed_id.eq.${userId}`);

    const connected = new Set<string>();
    for (const c of connections ?? []) {
      connected.add(c.follower_id === userId ? (c.followed_id as string) : (c.follower_id as string));
    }
    // Someone you share a room with counts too, when their profile is public
    // (utils/tonightRooms.ts says why only then).
    const rest = strangersIn(participantIds, userId, connected, clubMembers);
    if (rest.length > 0) for (const id of await roomedAmong(supabase, userId, rest)) connected.add(id);
    if (strangersIn(participantIds, userId, connected, clubMembers).length > 0) {
      return jsonError(clubSlug ? "Everyone has to be in the group, or someone you follow" : "You can only decide with people you follow or share a room with", 403);
    }
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
      club_id: clubId,
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
  const { pick, alternates, elapsedMs } = await resolveTonight(
    supabase,
    participants,
    constraints,
    new Set(),
  );

  return jsonSuccess({
    sessionId,
    constraints,
    participants: serializeParticipants(participants, userId),
    pick,
    alternates,
    elapsedMs,
  });
}
