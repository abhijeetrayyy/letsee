import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { safeNext } from "@/lib/auth/next";
import { authProblem } from "@/lib/auth/messages";
import { andNext, landingFor } from "@/lib/auth/landing";

/**
 * Where the confirmation email's link lands: Supabase has confirmed the
 * address and hands over a one-time code to swap for a session.
 *
 * Every way that can go wrong ends on the sign-in page with a short code the
 * page turns into a sentence (lib/auth/messages), never Supabase's text:
 *
 * - The link expired or was already used: Supabase sends `error_code` instead
 *   of a code, and sign-in offers a new link.
 * - The link was opened on another device or browser than the one that signed
 *   up. The code can only be swapped where sign-up started (PKCE keeps half of
 *   it there), but the address was confirmed before we got here — so that one
 *   isn't a failure: sign-in says the email is confirmed and to sign in.
 *
 * `next` is checked (lib/auth/next): it travels in an email, so it's never
 * trusted to point off the site.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const next = safeNext(searchParams.get("next"));
  const back = (problem: string) => NextResponse.redirect(new URL(`/login?error=${problem}${andNext(next)}`, req.url));

  const errorCode = searchParams.get("error_code");
  if (searchParams.get("error") || errorCode) {
    return back(errorCode === "otp_expired" ? "link_expired" : "link_invalid");
  }

  const code = searchParams.get("code");
  if (!code) return back("link_invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const problem = authProblem(error);
    return back(problem === "link_other_device" || problem === "link_expired" ? problem : "link_invalid");
  }

  return NextResponse.redirect(new URL(await landingFor(supabase, data.user?.id, next), req.url));
}
