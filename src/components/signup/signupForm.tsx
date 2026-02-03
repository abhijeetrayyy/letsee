"use client";

import Link from "next/link";
import React, { useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const MIN_PASSWORD_LENGTH = 6;

type SignupFormProps = {
  onSignup: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string;
  info?: string;
};

export default function SignupForm({
  onSignup,
  loading,
  error,
  info,
}: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    email.trim() &&
    passwordValid &&
    passwordsMatch &&
    !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError("");
    if (!canSubmit) {
      if (!passwordValid) setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      else if (!passwordsMatch) setLocalError("Passwords do not match.");
      return;
    }
    await onSignup(email.trim(), password);
  };

  const displayError = localError || error;

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
            Create an account
          </h1>
          <p className="text-neutral-400 text-sm mb-6">
            Sign up with your email to get started.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Password
              </label>
              <input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-neutral-500">
                At least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </div>

            <div>
              <label htmlFor="signup-confirm" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Confirm password
              </label>
              <input
                id="signup-confirm"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="••••••••"
              />
              {confirmPassword && !passwordsMatch && (
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

            {info && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200">
                {info}
              </div>
            )}
            {displayError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-200">
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="border-t-white" />
                  Creating account…
                </>
              ) : (
                "Sign up"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
