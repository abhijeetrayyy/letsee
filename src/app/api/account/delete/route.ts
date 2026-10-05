import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";


import { guard } from "@/lib/limits/guard";
export async function POST(req: NextRequest) {
  const limited = await guard("account", req);
  if (limited) return limited;
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

  /**
   * One function closes it (migration 119): it marks the account, schedules
   * the erase, and marks what this person sent as read — it can't be opened
   * now, and an unread dot would sit on someone else's People tab for a month.
   * It raises when there's no open account to close, where the old update
   * reported success having changed nothing.
   */
  const { data: when, error } = await supabase.rpc("close_my_account");
  if (error) {
    return jsonError(error.code === "P0002" ? "There's no open account to delete." : "Couldn't delete your account. Try again.", error.code === "P0002" ? 409 : 500);
  }
  const scheduledAt = new Date(String(when));

  // Sign out the user
  await supabase.auth.signOut();

  const res = jsonSuccess({
    ok: true,
    message: `Account scheduled for deletion on ${scheduledAt.toISOString().slice(0, 10)}. You have 30 days to reactivate by signing back in.`,
    deletionDate: scheduledAt.toISOString(),
  });
  // The middleware's "has a handle, not deleted" cookie must not outlive this.
  res.cookies.delete("ls-profile-ok");
  return res;
}
