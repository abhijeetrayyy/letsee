"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AuthShell, { Notice, authInput, authLink, authPrimary } from "@components/auth/AuthShell";
import { authMessage, authProblem } from "@/lib/auth/messages";
import { readAuthEmail, rememberAuthEmail, useCooldown } from "@/lib/auth/email";

/**
 * A link to set a new password.
 *
 * The answer is the same whether or not the address has an account: unlike
 * sign-up, where the person is trying to make one, saying "no account here"
 * on this page would only help someone checking whose email is registered.
 */
function ForgotPassword() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState("");
  const [wait, startWait] = useCooldown();

  useEffect(() => {
     
    setEmail((cur) => cur || readAuthEmail());
    if (searchParams.get("error") === "link_expired") {
      setError("That reset link has expired or was already used. Ask for a new one below.");
    }
     
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address || wait > 0 || loading) return;
    setLoading(true);
    setError("");
    rememberAuthEmail(address);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) {
        setError(authMessage(error));
        if (authProblem(error) === "email_rate_limit" || authProblem(error) === "rate_limit") startWait(60);
        return;
      }
      setSentTo(address);
      startWait(60);
    } catch {
      setError(authMessage({ name: "AuthRetryableFetchError", status: 0 }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={sentTo ? "Check your inbox" : "Reset your password"}
      lead={
        sentTo ? (
          <>If <span className="font-medium text-ink-0">{sentTo}</span> has an account, a link to set a new password is on its way. Open it on this device.</>
        ) : (
          "Enter your email and we'll send you a link to set a new password."
        )
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="forgot-email" className="mb-2 block text-sm font-medium text-ink-300">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="you@example.com"
            className={authInput}
          />
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={loading || wait > 0 || !email.trim()} className={authPrimary}>
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="border-t-page" />
              Sending…
            </>
          ) : wait > 0 ? (
            `Send again in ${wait}s`
          ) : sentTo ? (
            "Send it again"
          ) : (
            "Send reset link"
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-400">
        Remembered it?{" "}
        <Link href="/login" className={authLink}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPassword />
    </Suspense>
  );
}
