import type { createClient } from "@/utils/supabase/server";
import {
  loadParticipants,
  type TonightConstraints,
  type TonightParticipant,
} from "@/utils/tonight";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type LoadedSession = {
  id: number;
  createdBy: string;
  constraints: TonightConstraints;
  participants: TonightParticipant[];
  /** item_ids anyone in the room has voted out. */
  rejected: Set<string>;
  decidedItemId: string | null;
  decidedItemType: "movie" | "tv" | null;
};

/**
 * Load a session for a caller who must be a participant.
 *
 * RLS already restricts every one of these tables to participants, so a
 * non-participant gets an empty read rather than someone else's session — the
 * null return here is the second lock, not the only one.
 */
export async function loadSession(
  supabase: SupabaseClient,
  sessionId: number,
): Promise<LoadedSession | null> {
  const { data: session, error } = await supabase
    .from("watch_sessions")
    .select(
      "id, created_by, region, max_runtime, media_type, moods, allow_rewatch, decided_item_id, decided_item_type",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("tonight loadSession:", error);
    return null;
  }
  if (!session) return null;

  const [participantsRes, votesRes] = await Promise.all([
    supabase
      .from("watch_session_participants")
      .select("user_id")
      .eq("session_id", sessionId),
    supabase
      .from("watch_session_votes")
      .select("item_id, vote")
      .eq("session_id", sessionId)
      .eq("vote", "out"),
  ]);

  const userIds = (participantsRes.data ?? []).map((r) => r.user_id as string);
  if (userIds.length === 0) return null;

  return {
    id: Number(session.id),
    createdBy: session.created_by as string,
    constraints: {
      region: session.region ?? "US",
      maxRuntime: session.max_runtime ?? null,
      mediaType: session.media_type ?? "any",
      moods: Array.isArray(session.moods) ? session.moods : [],
      allowRewatch: session.allow_rewatch === true,
    },
    participants: await loadParticipants(supabase, userIds),
    rejected: new Set((votesRes.data ?? []).map((v) => String(v.item_id))),
    decidedItemId: session.decided_item_id ? String(session.decided_item_id) : null,
    decidedItemType: (session.decided_item_type as "movie" | "tv" | null) ?? null,
  };
}

/**
 * The shape every Tonight route returns for the room, for a stable client.
 *
 * `isYou` is marked here rather than inferred client-side from array order.
 * The caller does happen to be first — POST /api/tonight prepends them — but
 * relying on that would be a silent trap, and the copy needs the distinction:
 * "you haven't set your services" and "Priya hasn't set hers" are different
 * sentences and only one of them should ever be shown to Priya.
 */
export function serializeParticipants(
  participants: TonightParticipant[],
  viewerId?: string | null,
) {
  return participants.map((p) => ({
    userId: p.userId,
    username: p.username,
    avatarUrl: p.avatarUrl,
    hasProviders: p.providerIds.size > 0,
    isYou: p.userId === viewerId,
  }));
}
