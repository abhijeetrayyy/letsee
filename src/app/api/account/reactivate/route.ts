import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("deleted_at, deletion_scheduled_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.deleted_at) {
    return jsonError("Account is not scheduled for deletion", 400);
  }

  const now = new Date();
  const scheduled = profile.deletion_scheduled_at ? new Date(profile.deletion_scheduled_at) : null;

  if (scheduled && now > scheduled) {
    return jsonError("Grace period has expired. Account cannot be reactivated.", 400);
  }

  const { error } = await supabase
    .from("users")
    .update({ deleted_at: null, deletion_scheduled_at: null })
    .eq("id", userId);

  if (error) return jsonError(error.message, 500);

  return jsonSuccess({ ok: true, message: "Account reactivated successfully" });
}
