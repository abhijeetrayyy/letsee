import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

/** GET /api/wave?userId=… — have I waved at them, and have they waved at me? */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const target = req.nextUrl.searchParams.get("userId");
  if (!target) return jsonError("userId is required", 400);

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_waves")
    .select("sender_id, recipient_id")
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${userId})`,
    );

  const rows = data ?? [];
  return jsonSuccess({
    waved: rows.some((r) => r.sender_id === userId),
    wavedAtMe: rows.some((r) => r.sender_id === target),
  });
}

/**
 * POST /api/wave — wave at someone. Body: { userId }
 *
 * Idempotent: the table has a unique (sender, recipient) constraint so waving
 * twice is a no-op rather than a second notification. Blocks are enforced by
 * RLS, not here.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const target = body.userId;
  if (!target) return jsonError("userId is required", 400);
  if (target === userId) return jsonError("You can't wave at yourself", 400);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_waves")
    .insert({ sender_id: userId, recipient_id: target });

  if (error) {
    // 23505 = unique violation — already waved, which is success from the
    // caller's point of view.
    if (error.code === "23505") return jsonSuccess({ waved: true, alreadyWaved: true });
    console.error("wave insert:", error);
    return jsonError("Couldn't send that wave", 500);
  }

  return jsonSuccess({ waved: true });
}

/** DELETE /api/wave?userId=… — take a wave back. */
export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const target = req.nextUrl.searchParams.get("userId");
  if (!target) return jsonError("userId is required", 400);

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_waves")
    .delete()
    .eq("sender_id", userId)
    .eq("recipient_id", target);

  if (error) return jsonError("Couldn't withdraw that wave", 500);
  return jsonSuccess({ waved: false });
}
