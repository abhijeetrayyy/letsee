import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

const GRACE_PERIOD_DAYS = 30;

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  if (!body.password) {
    return jsonError("Password is required to delete your account", 400);
  }

  // Verify password by attempting sign-in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return jsonError("No email found", 400);

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: body.password,
  });

  if (signInError) {
    return jsonError("Invalid password", 401);
  }

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + GRACE_PERIOD_DAYS);

  const { error } = await supabase
    .from("users")
    .update({
      deleted_at: new Date().toISOString(),
      deletion_scheduled_at: scheduledAt.toISOString(),
    })
    .eq("id", userId);

  if (error) return jsonError(error.message, 500);

  // Sign out the user
  await supabase.auth.signOut();

  return jsonSuccess({
    ok: true,
    message: `Account scheduled for deletion on ${scheduledAt.toISOString().slice(0, 10)}. You have 30 days to reactivate by signing back in.`,
    deletionDate: scheduledAt.toISOString(),
  });
}
