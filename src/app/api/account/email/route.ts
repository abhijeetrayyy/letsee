import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function PATCH(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const supabase = await createClient();

  let body: { newEmail?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const { newEmail, password } = body;
  if (!newEmail || !password) {
    return jsonError("newEmail and password are required", 400);
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    return jsonError("Invalid email address", 400);
  }

  // Re-authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user?.email) {
    return jsonError("Authentication failed", 401);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });

  if (signInError) {
    return jsonError("Invalid password", 401);
  }

  // Update email — Supabase sends confirmation to new email
  const { error } = await supabase.auth.updateUser({ email: newEmail });

  if (error) {
    return jsonError(error.message, 400);
  }

  return jsonSuccess({
    ok: true,
    message: "Confirmation email sent to your new address. Click the link to complete the change.",
  });
}
