"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import AuthShell, { Notice, authInput, authLink, authPrimary } from "@components/auth/AuthShell";
import { authMessage } from "@/lib/auth/messages";

const MIN_PASSWORD_LENGTH = 6;

type Status = "checking" | "ready" | "invalid";

/**
 * Setting a new password from the reset email.
 *
 * The link signs you in for this (Supabase swaps its code for a session as
 * the page loads, or `token_hash` is verified here). That swap only works in
 * the browser that asked for the link, so one opened elsewhere is "this link
 * didn't work", with a way to ask for another — not a spinner forever.
 */
export default function UpdatePasswordComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const settle = (s: Status) => {
      if (!cancelled) setStatus(s);
    };
    const tokenHash = searchParams.get("token_hash");
    if (tokenHash && searchParams.get("type") === "recovery") {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(({ error }) => settle(error ? "invalid" : "ready"))
        .catch(() => settle("invalid"));
    } else {
      // A `?code=` is swapped by the client as it starts; give that a moment,
      // then the session either exists or the link didn't work. Started over
      // on every run (StrictMode runs this twice in development), so a
      // cancelled first run can't leave the page checking forever.
      const timer = setTimeout(() => {
        supabase.auth
          .getSession()
          .then(({ data: { session } }) => settle(session ? "ready" : "invalid"))
          .catch(() => settle("invalid"));
      }, 300);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(authMessage(error));
        return;
      }
      // Already signed in by the link, so straight in — not to a sign-in page
      // that would only send a signed-in person onward anyway.
      toast.success("Password changed.");
      router.replace("/app");
    } catch {
      setError(authMessage({ name: "AuthRetryableFetchError", status: 0 }));
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "checking") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-page px-4" role="status" aria-live="polite">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-ink-400">Checking your link…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell
        title="That link didn't work"
        lead="Reset links run out after a while, work once, and only in the browser you asked from. Ask for a new one and open it on this device."
      >
        <Link href="/forgot-password" className={authPrimary}>
          Send me a new link
        </Link>
        <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-400">
          Remembered it?{" "}
          <Link href="/login" className={authLink}>
            Sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" lead="You'll stay signed in on this device once it's set.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-ink-300">
            New password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              disabled={submitting}
              className={`${authInput} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 transition-colors hover:text-ink-300"
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <button type="submit" disabled={submitting || !password} className={authPrimary}>
          {submitting ? (
            <>
              <LoadingSpinner size="sm" className="border-t-page" />
              Saving…
            </>
          ) : (
            "Save new password"
          )}
        </button>
      </form>
    </AuthShell>
  );
}
