"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserCheck } from "lucide-react";
import SignupForm from "@/components/signup/signupForm";
import AuthShell, { authLink, authPrimary, authSecondary } from "@components/auth/AuthShell";
import ResendConfirmation from "@components/auth/ResendConfirmation";
import { supabase } from "@/utils/supabase/client";
import { nextQuery, safeNext } from "@/lib/auth/next";
import { authMessage, authProblem, signUpOutcome } from "@/lib/auth/messages";
import { readAuthEmail, rememberAuthEmail } from "@/lib/auth/email";

type Stage = "form" | "sent" | "resent" | "exists";

/**
 * Making an account, and saying plainly what happened.
 *
 * After "Create account" there are three outcomes, and each gets its own
 * screen instead of one sentence hedging across all of them:
 *
 * - A new address: check your inbox, with a way to send it again.
 * - An address that signed up before and never confirmed: we sent the link
 *   again (Supabase does), and we say that's what happened.
 * - An address that already has an account: no email is sent, and the screen
 *   says to sign in, with the address already filled in.
 *
 * lib/auth/messages tells them apart; the owner chose to say "already has an
 * account" outright (see signUpOutcome).
 */
export default function SignupPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"), "");
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already signed in: there's nothing to make.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next || "/app");
    });
     
    setInitialEmail(readAuthEmail());
  }, [router, next]);

  // Where the confirmation link lands; it carries `next` so an invitation
  // still ends in that person's room (the callback checks it again).
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next || "/app/welcome")}`;

  const signup = async (address: string, password: string) => {
    setLoading(true);
    setError("");
    setEmail(address);
    rememberAuthEmail(address);
    try {
      const { data, error } = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: redirectTo() } });
      const outcome = signUpOutcome({ user: data?.user, session: data?.session, error });
      if (outcome === "signed_in") {
        router.replace(`/app/welcome${nextQuery(next)}`);
        return;
      }
      if (outcome === "error") {
        // Asked again too soon: the last email is still the one to open.
        if (authProblem(error) === "email_rate_limit") setStage("resent");
        else setError(authMessage(error));
        return;
      }
      setStage(outcome === "check_email" ? "sent" : outcome === "resent_unconfirmed" ? "resent" : "exists");
    } catch {
      setError(authMessage({ name: "AuthRetryableFetchError", status: 0 }));
    } finally {
      setLoading(false);
    }
  };

  const signInHref = `/login${nextQuery(next)}`;

  if (stage === "exists") {
    return (
      <AuthShell title="You already have an account" lead={<><span className="font-medium text-ink-0">{email}</span> is already on letsee. Sign in with it — nothing was sent, and nothing has changed.</>}>
        <div className="flex flex-col gap-3">
          <Link href={signInHref} className={authPrimary}>
            <UserCheck className="size-4" aria-hidden />
            Sign in
          </Link>
          <Link href="/forgot-password" className={authSecondary}>
            Forgotten the password? Reset it
          </Link>
          <button type="button" onClick={() => setStage("form")} className="mt-2 text-sm text-ink-400 underline underline-offset-4 hover:text-ink-200">
            Use a different email
          </button>
        </div>
      </AuthShell>
    );
  }

  if (stage === "sent" || stage === "resent") {
    return (
      <AuthShell
        title={stage === "sent" ? "Check your inbox" : "You've started before"}
        lead={
          stage === "sent" ? (
            <>We sent a link to <span className="font-medium text-ink-0">{email}</span>. Open it to confirm your email, and you&apos;re in.</>
          ) : (
            <><span className="font-medium text-ink-0">{email}</span> began signing up earlier but was never confirmed. We&apos;ve sent the confirmation link again.</>
          )
        }
      >
        <ResendConfirmation email={email} redirectTo={redirectTo} justSent />
        <div className="mt-6 flex flex-col items-center gap-3 border-t border-line pt-6 text-sm text-ink-400">
          <button type="button" onClick={() => setStage("form")} className="underline underline-offset-4 hover:text-ink-200">
            Wrong email? Start again
          </button>
          <p>
            Already confirmed?{" "}
            <Link href={signInHref} className={authLink}>
              Sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      invite
      title="Create your account"
      lead="Keep a diary of what you watch, see what your friends love, and decide what to watch together."
    >
      <SignupForm key={initialEmail} onSignup={signup} loading={loading} error={error} initialEmail={initialEmail} signInHref={signInHref} />
    </AuthShell>
  );
}
