"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import toast from "react-hot-toast";

const MIN_PASSWORD_LENGTH = 6;

type Status = "checking" | "ready" | "invalid";

export default function UpdatePasswordComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (token_hash && type === "recovery") {
      supabase.auth
        .verifyOtp({ token_hash, type: "recovery" })
        .then(({ error }) => {
          if (error) {
            setStatus("invalid");
            return;
          }
          setStatus("ready");
        })
        .catch(() => setStatus("invalid"));
      return;
    }

    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setStatus(session ? "ready" : "invalid");
      });
    }, 150);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Updating password…");

    const { error } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? "Failed to update password.", { id: toastId });
      return;
    }

    toast.success("Password updated. Redirecting to log in…", { id: toastId });
    router.push("/login");
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-page px-4">
        <LoadingSpinner size="lg" className="border-t-white" />
        <p className="mt-4 text-sm text-ink-400">Verifying link…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-page px-4">
        <div className="rounded-2xl border border-line-strong/60 bg-raised/80 p-6 sm:p-8 max-w-sheet w-full text-center">
          <h1 className="text-xl font-medium text-ink-0 mb-2">Invalid or expired link</h1>
          <p className="text-ink-400 text-sm mb-6">
            This reset link is invalid or has expired. Request a new one from the forgot password page.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-active px-4 py-2 font-medium text-ink-0 hover:bg-hover"
          >
            Request new link
          </Link>
          <p className="mt-6 text-sm text-ink-500">
            <Link href="/login" className="text-ink-300 hover:text-ink-200">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirmPassword &&
    !submitting;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-page px-4 py-10">
      <div className="w-full max-w-sheet">
        <div className="text-center mb-8">
          <Link
            href="/app"
            className="text-2xl font-bold text-ink-0 hover:text-ink-300 transition-colors"
          >
            Let&apos;s See
          </Link>
          <p className="text-ink-400 mt-1 text-sm">Social media for cinema.</p>
        </div>

        <div className="rounded-2xl border border-line-strong/60 bg-raised/80 p-6 sm:p-8 shadow-xl">
          <h1 className="text-xl sm:text-2xl font-medium text-ink-0 mb-1">
            Set new password
          </h1>
          <p className="text-ink-400 text-sm mb-6">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-ink-300 mb-1.5">
                New password
              </label>
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                placeholder="••••••••"
                disabled={submitting}
                className="w-full rounded-lg bg-overlay border border-line-input px-4 py-3 text-ink-0 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent disabled:opacity-60"
              />
              <p className="mt-1 text-xs text-ink-500">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-ink-300 mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                disabled={submitting}
                className="w-full rounded-lg bg-overlay border border-line-input px-4 py-3 text-ink-0 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent disabled:opacity-60"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-ink-300">Passwords do not match.</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-line-input bg-overlay text-ink-500 focus:ring-focus"
              />
              Show passwords
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-active py-3 font-semibold text-ink-0 hover:bg-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size="sm" className="border-t-white" />
                  Updating…
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-400">
            <Link href="/login" className="font-medium text-ink-300 hover:text-ink-200">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
