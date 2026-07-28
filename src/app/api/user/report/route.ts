import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { profileId?: string; reason?: string; details?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { profileId, reason, details } = body;
  if (!profileId || !reason) return jsonError("profileId and reason are required", 400);

  const validReasons = ["spam", "harassment", "inappropriate", "fake", "other"];
  if (!validReasons.includes(reason)) {
    return jsonError(`reason must be one of: ${validReasons.join(", ")}`, 400);
  }

  const { error } = await supabase.from("user_reports").insert({
    reporter_id: userId,
    reported_user_id: profileId,
    reason,
    details: details || null,
  });

  if (error) return jsonError(error.message, 500);

  return jsonSuccess({ ok: true, reported: true });
}
