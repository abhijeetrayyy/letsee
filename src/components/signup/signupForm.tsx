"use client";

import Link from "next/link";
import React, { useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Film, Eye, EyeOff, Check, X } from "lucide-react";

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
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit = email.trim() && passwordValid && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError("");
    if (!canSubmit) {
      if (!passwordValid)
        setLocalError(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        );
      else if (!passwordsMatch) setLocalError("Passwords do not match.");
      return;
    }
    await onSignup(email.trim(), password);
  };

  const displayError = localError || error;

  const passwordChecks = [
    { label: "At least 6 characters", valid: password.length >= MIN_PASSWORD_LENGTH },
    { label: "Passwords match", valid: passwordsMatch },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-950 px-4 py-10">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-2xl font-bold text-white hover:text-brand-400 transition-colors"
          >
            <Film className="w-7 h-7 text-brand-500" />
            LetSee
          </Link>
          <p className="text-surface-500 mt-1.5 text-sm">
            Start your cinematic journey
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-800 bg-surface-900/80 p-6 sm:p-8 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">
              Create your account
            </h1>
            <p className="text-surface-400 text-sm">
              Join the community of film lovers
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="signup-email"
                className="block text-sm font-medium text-surface-300 mb-2"
              >
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
                className="w-full rounded-xl bg-surface-800 border border-surface-700 px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-surface-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full rounded-xl bg-surface-800 border border-surface-700 px-4 py-3 pr-12 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-confirm"
                className="block text-sm font-medium text-surface-300 mb-2"
              >
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
                className="w-full rounded-xl bg-surface-800 border border-surface-700 px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>

            {/* Password requirements */}
            {password.length > 0 && (
              <div className="flex flex-col gap-1.5 -mt-1">
                {passwordChecks.map((check) => (
                  <div
                    key={check.label}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      check.valid ? "text-brand-400" : "text-surface-500"
                    }`}
                  >
                    {check.valid ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    {check.label}
                  </div>
                ))}
              </div>
            )}

            {info && (
              <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 px-4 py-3 text-sm text-brand-300 flex items-start gap-2">
                <span className="mt-0.5 shrink-0">✉️</span>
                {info}
              </div>
            )}
            {displayError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-xl bg-brand-500 hover:bg-brand-600 text-surface-950 font-semibold py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-brand-500/20"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="border-t-surface-950" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-surface-800 text-center">
            <p className="text-sm text-surface-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-brand-400 hover:text-brand-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
