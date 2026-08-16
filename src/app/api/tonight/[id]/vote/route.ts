import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { resolveTonight } from "@/utils/tonight";
import { loadSession, serializeParticipants } from "@/utils/tonightSession";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/tonight/[id]/vote — record a verdict on a candidate and return
 * the next pick.
 *
 * "Next" is a vote of `out`, not a shuffle. That distinction is the whole
 * point: a rejection at the moment of choosing, with the alternatives on
 * screen, is the most honest preference signal this product will ever collect,
 * and it costs the user nothing to give.
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
  const vote = body.vote === "in" ? "in" : "out";
  if (!itemId) return jsonError("itemId is required", 400);

  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return jsonError("Session not found", 404);
  if (!session.participants.some((p) => p.userId === userId)) {
    return jsonError("Session not found", 404);
  }

  const { error } = await supabase.from("watch_session_votes").upsert(
    {
      session_id: sessionId,
      user_id: userId,
      item_id: itemId,
      item_type: itemType,
      vote,
    },
    { onConflict: "session_id,user_id,item_id" },
  );

  if (error) {
    console.error("tonight vote:", error);
    return jsonError("Failed to record that", 500);
  }

  // One veto is enough — the same reasoning as scoring taste fit on the
  // minimum. A title anyone has rejected is out for the room.
  const rejected = new Set(session.rejected);
  if (vote === "out") rejected.add(itemId);
  else rejected.delete(itemId);

  const { pick, alternates } = await resolveTonight(
    supabase,
    session.participants,
    session.constraints,
    rejected,
  );

  return jsonSuccess({
    sessionId: session.id,
    constraints: session.constraints,
    participants: serializeParticipants(session.participants),
    pick,
    alternates,
  });
}
