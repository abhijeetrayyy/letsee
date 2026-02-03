import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

/**
 * Server-side auth callback for email links (signup confirm, password reset, etc.).
 * Supabase can redirect here with token_hash and type; we verify OTP and redirect.
 * Supports both "next" and "redirect_to" query params (Supabase docs use redirect_to).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath =
    searchParams.get("next") ??
    searchParams.get("redirect_to") ??
    "/app";

  const safeNext = nextPath.startsWith("/") ? nextPath : `/${nextPath}`;

  if (!token_hash || !type) {
    redirect(`/login?error=${encodeURIComponent("Missing token or type.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message ?? "Invalid or expired link.")}`
    );
  }

  redirect(safeNext);
}
