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

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: "", color: "" };
  if (password.length < MIN_PASSWORD_LENGTH) return { level: 1, label: "Weak", color: "bg-red-500" };
  if (password.length < 10) return { level: 2, label: "Fair", color: "bg-amber-500" };
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { level: 4, label: "Strong", color: "bg-brand-500" };
  return { level: 3, label: "Good", color: "bg-blue-500" };
}

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
  const strength = getPasswordStrength(password);

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
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-brand-500/8 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/6 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: "1s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,197,94,0.03)_0%,transparent_70%)]" />
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
        <div className="rounded-2xl border border-white/10 bg-surface-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/30">
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
                className="w-full rounded-xl bg-surface-800/60 border border-surface-700/50 px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40 transition-all"
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
                  className="w-full rounded-xl bg-surface-800/60 border border-surface-700/50 px-4 py-3 pr-12 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40 transition-all"
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
              {/* Password strength meter */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strength.level ? strength.color : "bg-surface-700"
                        }`}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className={`text-xs ${
                      strength.level <= 1 ? "text-red-400" :
                      strength.level === 2 ? "text-amber-400" :
                      "text-brand-400"
                    }`}>
                      {strength.label}
                    </p>
                  )}
                </div>
              )}
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
                className={`w-full rounded-xl bg-surface-800/60 border px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 transition-all ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? "border-brand-500/40 focus:ring-brand-500/30 focus:border-brand-500/40"
                      : "border-red-500/40 focus:ring-red-500/30 focus:border-red-500/40"
                    : "border-surface-700/50 focus:ring-brand-500/30 focus:border-brand-500/40"
                }`}
                placeholder="••••••••"
              />
              {confirmPassword.length > 0 && (
                <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${
                  passwordsMatch ? "text-brand-400" : "text-red-400"
                }`}>
                  {passwordsMatch ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </div>
              )}
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
              className="btn-primary w-full justify-center py-3.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none"
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

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
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
