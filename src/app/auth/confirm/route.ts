import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { safeNext } from "@/lib/auth/next";
import { authProblem } from "@/lib/auth/messages";
import { andNext, landingFor } from "@/lib/auth/landing";

/**
 * Email links in the token-hash form (`?token_hash=…&type=…`), which work on
 * any device — unlike /auth/callback's code, which only swaps in the browser
 * that asked. Supabase sends links here when its email templates point here.
 *
 * `next` (or Supabase's own `redirect_to`, which may be a full address) is
 * only followed to a path on this site (lib/auth/next). A reset link always
 * lands on the page that sets the new password.
 */
const TYPES = new Set<EmailOtpType>(["signup", "email", "recovery", "invite", "magiclink", "email_change"]);

function requestedNext(searchParams: URLSearchParams, origin: string): string | null {
  const raw = searchParams.get("next") ?? searchParams.get("redirect_to");
  if (!raw) return null;
  try {
    const url = new URL(raw, origin);
    return url.origin === origin ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(requestedNext(searchParams, origin));
  const back = (problem: string) => NextResponse.redirect(new URL(`/login?error=${problem}${andNext(next)}`, request.url));

  if (!tokenHash || !type || !TYPES.has(type)) return back("link_invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    if (type === "recovery") return NextResponse.redirect(new URL("/forgot-password?error=link_expired", request.url));
    return back(authProblem(error) === "link_expired" ? "link_expired" : "link_invalid");
  }

  if (type === "recovery") return NextResponse.redirect(new URL("/update-password", request.url));
  return NextResponse.redirect(new URL(await landingFor(supabase, data.user?.id, next), request.url));
}
