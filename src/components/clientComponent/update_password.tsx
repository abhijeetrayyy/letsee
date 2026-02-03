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
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4">
        <LoadingSpinner size="lg" className="border-t-white" />
        <p className="mt-4 text-sm text-neutral-400">Verifying link…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4">
        <div className="rounded-2xl border border-neutral-700/60 bg-neutral-900/80 p-6 sm:p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-white mb-2">Invalid or expired link</h1>
          <p className="text-neutral-400 text-sm mb-6">
            This reset link is invalid or has expired. Request a new one from the forgot password page.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500"
          >
            Request new link
          </Link>
          <p className="mt-6 text-sm text-neutral-500">
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
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
    <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/app"
            className="text-2xl font-bold text-white hover:text-neutral-300 transition-colors"
          >
            Let&apos;s See
          </Link>
          <p className="text-neutral-400 mt-1 text-sm">Social media for cinema.</p>
        </div>

        <div className="rounded-2xl border border-neutral-700/60 bg-neutral-900/80 p-6 sm:p-8 shadow-xl">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Set new password
          </h1>
          <p className="text-neutral-400 text-sm mb-6">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-neutral-300 mb-1.5">
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
                className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60"
              />
              <p className="mt-1 text-xs text-neutral-500">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-300 mb-1.5">
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
                className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-amber-400">Passwords do not match.</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800 text-indigo-600 focus:ring-indigo-500"
              />
              Show passwords
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

          <p className="mt-6 text-center text-sm text-neutral-400">
            <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
