/**
 * What to tell someone when signing up, signing in or an email link goes
 * wrong — in words, never Supabase's.
 *
 * Supabase's messages are written for developers ("Email not confirmed",
 * "PKCE code verifier not found in storage…"), and they were shown verbatim.
 * Errors are matched on their `code`, which is stable, falling back to the
 * HTTP status and the error's name; the message text is never shown.
 *
 * Pages that are redirected to with a problem (`/login?error=…`) get a short
 * code, not a sentence. A sentence in a link is text anyone can write and
 * have shown on our page, and it was decoded twice, so a stray `%` crashed it.
 */

type AuthLikeError = { code?: string | null; status?: number | null; name?: string | null; message?: string | null } | null | undefined;

export type AuthProblem =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "user_exists"
  | "weak_password"
  | "invalid_email"
  | "email_rate_limit"
  | "rate_limit"
  | "signups_off"
  | "same_password"
  | "link_expired"
  | "link_other_device"
  | "link_invalid"
  | "session_missing"
  | "offline"
  | "unknown";

export function authProblem(error: AuthLikeError): AuthProblem {
  if (!error) return "unknown";
  const code = error.code ?? "";
  const name = error.name ?? "";
  switch (code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "user_exists";
    case "weak_password":
      return "weak_password";
    case "email_address_invalid":
    case "email_address_not_authorized":
      return "invalid_email";
    case "over_email_send_rate_limit":
      return "email_rate_limit";
    case "over_request_rate_limit":
      return "rate_limit";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signups_off";
    case "same_password":
      return "same_password";
    case "otp_expired":
    case "flow_state_expired":
      return "link_expired";
    case "pkce_code_verifier_not_found":
      return "link_other_device";
    case "bad_code_verifier":
    case "flow_state_not_found":
    case "otp_disabled":
      return "link_invalid";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
    case "refresh_token_already_used":
      return "session_missing";
  }
  if (name === "AuthPKCECodeVerifierMissingError") return "link_other_device";
  if (name === "AuthSessionMissingError") return "session_missing";
  // A fetch that never reached Supabase: no status, or the retryable kind.
  if (name === "AuthRetryableFetchError" || error.status === 0) return "offline";
  if (error.status === 429) return "rate_limit";
  return "unknown";
}

const SENTENCES: Record<AuthProblem, string> = {
  invalid_credentials: "That email and password don't match. Check them, or reset your password.",
  email_not_confirmed: "Confirm your email first — the link is in the email we sent when you signed up.",
  user_exists: "There's already an account with this email.",
  weak_password: "Choose a stronger password: at least 6 characters, and not a common one.",
  invalid_email: "That doesn't look like an email address we can send to. Check it and try again.",
  email_rate_limit: "We've just sent you an email. Give it a minute before asking for another.",
  rate_limit: "Too many tries in a short time. Wait a minute, then try again.",
  signups_off: "New accounts are paused for the moment. Try again later.",
  same_password: "That's the password you already have. Choose a new one.",
  link_expired: "That link has expired. Ask for a new one below.",
  link_other_device: "Your email is confirmed. Sign in to carry on.",
  link_invalid: "That link didn't work — it may have been used already. Ask for a new one below.",
  session_missing: "You've been signed out. Sign in again to carry on.",
  offline: "Couldn't reach letsee. Check your connection and try again.",
  unknown: "Something went wrong on our side. Try again in a moment.",
};

export function authMessage(error: AuthLikeError): string {
  return SENTENCES[authProblem(error)];
}

/** The problems a page can be sent to with `?error=`, and the one notice. Anything else is ignored. */
const LINKABLE = new Set<AuthProblem>(["link_expired", "link_other_device", "link_invalid", "session_missing"]);

export function messageForCode(code: string | null | undefined): { kind: "error" | "notice"; text: string; problem: AuthProblem } | null {
  if (!code || !LINKABLE.has(code as AuthProblem)) return null;
  const problem = code as AuthProblem;
  // Confirmed on another device isn't a failure — it worked, there's one step left.
  return { kind: problem === "link_other_device" ? "notice" : "error", text: SENTENCES[problem], problem };
}

/**
 * What a sign-up answer means.
 *
 * Email confirmation is on, so a new address comes back with a user and no
 * session, and a confirmation email goes out. An address that already has a
 * confirmed account comes back looking the same but with no identities, and no
 * email is sent — Supabase's way of not saying the account exists. The owner
 * chose to say it plainly instead (5 Oct 2026): someone signing up with an
 * address they've used before should be told to sign in, not left waiting for
 * an email that will never come. An address that signed up earlier and never
 * confirmed gets its confirmation sent again; that's told apart from a new one
 * by the gap between the account's creation and the email just sent.
 */
export type SignUpOutcome = "signed_in" | "check_email" | "resent_unconfirmed" | "already_registered" | "error";

type SignUpUser = { identities?: unknown[] | null; created_at?: string | null; confirmation_sent_at?: string | null } | null | undefined;

export function signUpOutcome(result: { user?: SignUpUser; session?: unknown; error?: AuthLikeError }): SignUpOutcome {
  if (result.error) return authProblem(result.error) === "user_exists" ? "already_registered" : "error";
  if (result.session) return "signed_in";
  const user = result.user;
  if (!user) return "error";
  if (Array.isArray(user.identities) && user.identities.length === 0) return "already_registered";
  const created = Date.parse(user.created_at ?? "");
  const sent = Date.parse(user.confirmation_sent_at ?? "");
  if (Number.isFinite(created) && Number.isFinite(sent) && sent - created > 60_000) return "resent_unconfirmed";
  return "check_email";
}
