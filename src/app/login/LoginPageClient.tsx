"use client";

import LoginForm from "@/components/login/loginform";
import AuthShell, { authPrimary } from "@components/auth/AuthShell";
import ResendConfirmation from "@components/auth/ResendConfirmation";
import { supabase } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { nextQuery, safeNext } from "@/lib/auth/next";
import { authMessage, authProblem, messageForCode } from "@/lib/auth/messages";
import { readAuthEmail, rememberAuthEmail } from "@/lib/auth/email";
import { forgetInviter } from "@/lib/people/invite";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  // Where to go after signing in: back to the page that sent you here, or home (lib/auth/next).
  const next = safeNext(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  /** Offer the confirmation email again: the account isn't confirmed, or its link failed. */
  const [offerResend, setOfferResend] = useState(false);
  /**
   * Set when the middleware bounced a signed-in-but-deleted account here.
   *
   * At that moment the session is valid — the redirect happens *after* the sign
   * in succeeds — so /api/account/reactivate, which requires auth, is callable
   * from this screen. That is the only place the grace period can be escaped
   * from.
   */
  const [deletedAccount, setDeletedAccount] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    /**
     * Not when we were sent here *because* the account is deleted: a deleted
     * user still holds a valid session, and leaving would loop through the
     * middleware with the reactivation offer never getting a frame.
     */
    if (errorParam === "account-deleted") return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next);
    });
  }, [router, errorParam, next]);

  useEffect(() => {
     
    setEmail((cur) => cur || readAuthEmail());
    if (errorParam === "account-deleted") {
      setDeletedAccount(true);
      return;
    }
    // Only problems we know, in our words: free text in a link is never shown (lib/auth/messages).
    const known = messageForCode(errorParam);
    if (known?.kind === "notice") setInfo(known.text);
    else if (known) {
      setError(known.text);
      setOfferResend(known.problem === "link_expired" || known.problem === "link_invalid");
    }
    if (searchParams.get("status") === "account-deleted") {
      setInfo("Your account is scheduled for deletion. Sign back in within 30 days to cancel it.");
    }
     
  }, [errorParam, searchParams]);

  const reactivate = async () => {
    setReactivating(true);
    setError("");
    try {
      const res = await fetch("/api/account/reactivate", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Couldn't bring your account back. Try again.");
        return;
      }
      setDeletedAccount(false);
      router.push("/app");
    } catch {
      setError(authMessage({ name: "AuthRetryableFetchError", status: 0 }));
    } finally {
      setReactivating(false);
    }
  };

  const login = async (address: string, password: string) => {
    setLoading(true);
    setError("");
    setInfo("");
    setOfferResend(false);
    rememberAuthEmail(address);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: address, password });
      if (error) {
        const problem = authProblem(error);
        setError(authMessage(error));
        setOfferResend(problem === "email_not_confirmed");
        return;
      }
      // Someone who already has a profile isn't joining anyone: an invitation
      // remembered on this device would otherwise follow them around sign-in
      // for a month ("X invited you").
      const id = data.user?.id;
      if (id) {
        const { data: row } = await supabase.from("users").select("username").eq("id", id).maybeSingle();
        if (row?.username) forgetInviter();
      }
      router.replace(next);
    } catch {
      setError(authMessage({ name: "AuthRetryableFetchError", status: 0 }));
    } finally {
      setLoading(false);
    }
  };

  if (deletedAccount) {
    return (
      <AuthShell
        title="This account is scheduled for deletion"
        lead="You asked us to delete it. Nothing has been removed yet — you can bring it back exactly as it was. Once the 30 days are up it's deleted for good."
      >
        <button onClick={reactivate} disabled={reactivating} className={authPrimary}>
          {reactivating ? "Bringing it back…" : "Reactivate my account"}
        </button>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <button
          onClick={async () => {
            await supabase.auth.signOut().catch(() => {});
            setDeletedAccount(false);
          }}
          className="mt-4 text-sm text-ink-400 underline hover:text-ink-200"
        >
          Sign out and leave it deleted
        </button>
      </AuthShell>
    );
  }

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next === "/app" ? "/app/welcome" : next)}`;

  return (
    <AuthShell invite title="Welcome back" lead="Sign in to your diary, your people and what's up next.">
      <LoginForm
        email={email}
        onEmailChange={setEmail}
        onLogin={login}
        loading={loading}
        error={error}
        info={info}
        signUpHref={`/signup${nextQuery(next)}`}
        extra={
          offerResend ? (
            email.trim() ? (
              <ResendConfirmation key={email.trim()} email={email.trim()} redirectTo={redirectTo} hint={false} />
            ) : (
              <p className="text-sm text-ink-400">Type your email above to get a new confirmation link.</p>
            )
          ) : null
        }
      />
    </AuthShell>
  );
}
