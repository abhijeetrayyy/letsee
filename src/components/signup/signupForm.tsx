"use client";

import Link from "next/link";
import React, { useState } from "react";
import Mark from "@components/ds/Mark";
import InviteBanner from "@components/doors/InviteBanner";
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
  if (password.length < MIN_PASSWORD_LENGTH) return { level: 1, label: "Weak", color: "bg-danger-fill" };
  if (password.length < 10) return { level: 2, label: "Fair", color: "bg-ink-400" };
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { level: 4, label: "Strong", color: "bg-action" };
  return { level: 3, label: "Good", color: "bg-accent-soft" };
}

export default function SignupForm({
  onSignup,
  loading,
  error,
  info,
}: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordValid = password.length >= MIN_PASSWORD_LENGTH;
  /**
   * One password field, not two. "Confirm password" was a second field every
   * new person had to fill before they'd seen anything, against a typo the
   * show-password button already catches. And the button can be pressed as
   * soon as both fields have something in them, so a password that's too
   * short gets a sentence saying so rather than a grey button saying nothing.
   */
  const canSubmit = email.trim() && password && !loading;
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError("");
    if (!canSubmit) {
      return;
    }
    if (!passwordValid) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    await onSignup(email.trim(), password);
  };

  const displayError = localError || error;

  const passwordChecks = [{ label: `At least ${MIN_PASSWORD_LENGTH} characters`, valid: password.length >= MIN_PASSWORD_LENGTH }];

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-page px-4 py-10">
      <div className="relative w-full max-w-read">
        <Link href="/" aria-label="letsee" className="mb-10 inline-flex">
          <Mark withName={false} size="lg" />
        </Link>

        <div>
          <InviteBanner />
          <div className="mb-6">
            <h1 className="text-4xl leading-tight text-ink-0">Start with someone.</h1>
            <p className="mt-2 text-base text-ink-400">Make an account, then bring one person you watch with.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="signup-email"
                className="block text-sm font-medium text-ink-300 mb-2"
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
                className="w-full rounded-xl bg-overlay/60 px-4 py-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder-ink-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-sm font-medium text-ink-300 mb-2"
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
                  className="w-full rounded-xl bg-overlay/60 px-4 py-3 pr-12 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder-ink-500 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300 transition-colors"
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
                          i <= strength.level ? strength.color : "bg-hover"
                        }`}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className={`text-xs ${
                      strength.level <= 1 ? "text-danger" :
                      strength.level === 2 ? "text-ink-300" :
                      "text-accent"
                    }`}>
                      {strength.label}
                    </p>
                  )}
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
                      check.valid ? "text-accent" : "text-ink-500"
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
              <div role="status" className="rounded-xl bg-action/10 border border-accent-strong/20 px-4 py-3 text-sm text-accent-soft">
                <div className="flex items-start gap-2">
                  <span aria-hidden className="mt-0.5 shrink-0">✉️</span>
                  <span>{info}</span>
                </div>
                {/* The message names signing in as an option, so the option has
                    to be here. Telling someone to sign in and then leaving them
                    to find the link is the same dead end one step later. */}
                <Link
                  href="/login"
                  className="mt-2 inline-block font-medium text-accent-softer underline underline-offset-2 hover:text-ink-0"
                >
                  Go to sign in
                </Link>
              </div>
            )}
            {displayError && (
              <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
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
                  <LoadingSpinner size="sm" className="border-t-page" />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-line text-center">
            <p className="text-sm text-ink-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-accent underline decoration-line-input underline-offset-4 hover:text-accent-soft transition-colors"
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
