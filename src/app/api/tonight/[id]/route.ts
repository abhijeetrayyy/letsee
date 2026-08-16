import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { resolveTonight } from "@/utils/tonight";
import { loadSession, serializeParticipants } from "@/utils/tonightSession";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/tonight/[id] — re-resolve an existing session.
 *
 * Deliberately recomputes rather than storing the candidate list: someone in
 * the room may have added to their watchlist, or voted a title out from
 * another device, between the session opening and this read.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const { id } = await ctx.params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) return jsonError("Invalid session id", 400);

  const supabase = await createClient();
  const session = await loadSession(supabase, sessionId);
  if (!session) return jsonError("Session not found", 404);

  if (!session.participants.some((p) => p.userId === userId)) {
    return jsonError("Session not found", 404);
  }

  const { pick, alternates, elapsedMs } = await resolveTonight(
    supabase,
    session.participants,
    session.constraints,
    session.rejected,
  );

  return jsonSuccess({
    sessionId: session.id,
    constraints: session.constraints,
    participants: serializeParticipants(session.participants, userId),
    decided: session.decidedItemId
      ? { itemId: session.decidedItemId, itemType: session.decidedItemType }
      : null,
    pick,
    alternates,
    elapsedMs,
  });
}
