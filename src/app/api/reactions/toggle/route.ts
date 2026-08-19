import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export const dynamic = "force-dynamic";

// POST /api/reactions/toggle — toggle like on a target
export async function POST(request: Request) {
  const supabase = await createClient();
  const userId = await getAuthUserId();

  if (!userId) {
    return jsonError("Unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.targetType || !body.targetId) {
    return jsonError("targetType and targetId are required", 400);
  }

  const { targetType, targetId } = body;

  const validTypes = ["review", "watched", "rating", "list", "comment", "activity"];
  if (!validTypes.includes(targetType)) {
    return jsonError("Invalid targetType", 400);
  }

  const targetIdNum = Number(targetId);
  if (!Number.isFinite(targetIdNum)) {
    return jsonError("Invalid targetId", 400);
  }

  // Check if reaction exists
  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetIdNum)
    .maybeSingle();

  if (existing) {
    // Unlike: delete the reaction
    const { error: deleteError } = await supabase
      .from("reactions")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Get updated count
    const { count } = await supabase
      .from("reactions")
      .select("id", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetIdNum);

    return NextResponse.json({ liked: false, count: count ?? 0 });
  } else {
    // Like: insert reaction
    const { error: insertError } = await supabase
      .from("reactions")
      .insert({
        user_id: userId,
        target_type: targetType,
        target_id: targetIdNum,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { count } = await supabase
      .from("reactions")
      .select("id", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetIdNum);

    return NextResponse.json({ liked: true, count: count ?? 0 });
  }
}

// GET /api/reactions?targetType=review&targetId=123 — get like count and user's reaction
export async function GET(request: Request) {
  const supabase = await createClient();
  const userId = await getAuthUserId();

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");

  if (!targetType || !targetId) {
    return jsonError("targetType and targetId are required", 400);
  }

  const targetIdNum = Number(targetId);
  if (!Number.isFinite(targetIdNum)) {
    return jsonError("Invalid targetId", 400);
  }

  // Get count
  const { count } = await supabase
    .from("reactions")
    .select("id", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetIdNum);

  // Get user's reaction if logged in
  let liked = false;
  if (userId) {
    const { data: existing } = await supabase
      .from("reactions")
      .select("id")
      .eq("user_id", userId)
      .eq("target_type", targetType)
      .eq("target_id", targetIdNum)
      .maybeSingle();

    if (existing) liked = true;
  }

  return NextResponse.json({ liked, count: count ?? 0 });
}
