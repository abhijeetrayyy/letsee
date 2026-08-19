"use client";

import LoginForm from "@/components/login/loginform";
import { supabase } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPageClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  /**
   * Set when the middleware bounced a signed-in-but-deleted account here.
   *
   * At that moment the session is valid — the redirect happens *after* the sign
   * in succeeds — so /api/account/reactivate, which requires auth, is callable
   * from this screen. That is the only place the grace period can be escaped
   * from, and until now nothing rendered it: the page displayed the raw string
   * "account-deleted" as an error and offered no way out, which meant a 30-day
   * countdown with no cancel button.
   */
  const [deletedAccount, setDeletedAccount] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    /**
     * Not when we were sent here *because* the account is deleted.
     *
     * A deleted user still holds a valid session at this point, so the old
     * unconditional redirect pushed them to /app, the middleware saw
     * `deleted_at` and bounced them straight back — a loop, with the
     * reactivation offer below never getting a frame to render in. This is the
     * one screen where having a session is not a reason to leave.
     */
    if (searchParams.get("error") === "account-deleted") return;

    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push("/app");
      }
    };
    checkUser();
  }, [router, searchParams]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const statusParam = searchParams.get("status");
    if (errorParam === "account-deleted") {
      // A slug is not a sentence. This one was being shown to users verbatim.
      setDeletedAccount(true);
      setError("");
    } else if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
    if (statusParam === "check-email") {
      setInfo("Check your email to confirm your account.");
    }
    if (statusParam === "account-deleted") {
      setInfo(
        "Your account is scheduled for deletion. Sign back in within 30 days to cancel it.",
      );
    }
  }, [searchParams]);

  const reactivate = async () => {
    setReactivating(true);
    setError("");
    try {
      const res = await fetch("/api/account/reactivate", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "Couldn't reactivate your account.");
        return;
      }
      setDeletedAccount(false);
      router.push("/app");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setReactivating(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/app");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (deletedAccount) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">
          This account is scheduled for deletion
        </h1>
        <p className="mt-3 text-sm text-surface-300">
          You asked us to delete it. Nothing has been removed yet — you can
          bring it back exactly as it was, with everything still in place.
          Once the 30 days are up it is deleted permanently.
        </p>
        <button
          onClick={reactivate}
          disabled={reactivating}
          className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white min-h-[44px] hover:bg-brand-400 disabled:opacity-50 transition-colors"
        >
          {reactivating ? "Bringing it back…" : "Reactivate my account"}
        </button>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        ) : null}
        <button
          onClick={async () => {
            await supabase.auth.signOut().catch(() => {});
            setDeletedAccount(false);
          }}
          className="mt-4 text-sm text-surface-400 underline hover:text-surface-200"
        >
          Sign out and leave it deleted
        </button>
      </div>
    );
  }

  return (
    <LoginForm
      onLogin={login}
      loading={loading}
      error={error}
      info={info}
    />
  );
}
