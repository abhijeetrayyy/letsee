"use client";

import Link from "next/link";
import React, { useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Eye, EyeOff } from "lucide-react";
import { Notice, authInput, authLink, authPrimary } from "@components/auth/AuthShell";

export const MIN_PASSWORD_LENGTH = 6;

type SignupFormProps = {
  onSignup: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string;
  initialEmail?: string;
  /** The sign-in link, carrying where you were going. */
  signInHref: string;
};

function getPasswordStrength(password: string): { level: number; label: string; color: string } {
  if (password.length === 0) return { level: 0, label: "", color: "" };
  if (password.length < MIN_PASSWORD_LENGTH) return { level: 1, label: "Too short", color: "bg-danger-fill" };
  if (password.length < 10) return { level: 2, label: "Fair", color: "bg-ink-400" };
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { level: 4, label: "Strong", color: "bg-action" };
  return { level: 3, label: "Good", color: "bg-accent-soft" };
}

/**
 * Two fields and a button. One password field, not two: a second "confirm
 * password" is a field every new person fills before they've seen anything,
 * against a typo the show-password button already catches. The button works
 * as soon as both fields have something in them, so a password that's too
 * short gets a sentence rather than a grey button that says nothing.
 */
export default function SignupForm({ onSignup, loading, error, initialEmail = "", signInHref }: SignupFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = Boolean(email.trim() && password && !loading);
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError("");
    if (!canSubmit) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    await onSignup(email.trim(), password);
  };

  const displayError = localError || error;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="signup-email" className="mb-2 block text-sm font-medium text-ink-300">
            Email
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className={authInput}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="mb-2 block text-sm font-medium text-ink-300">
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
              disabled={loading}
              aria-describedby="signup-password-help"
              className={`${authInput} pr-12`}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
          <div id="signup-password-help" className="mt-2 min-h-5">
            {password.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex flex-1 gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.level ? strength.color : "bg-hover"}`} />
                  ))}
                </div>
                <p className={`text-xs ${strength.level <= 1 ? "text-danger" : strength.level === 2 ? "text-ink-300" : "text-accent"}`}>{strength.label}</p>
              </div>
            )}
          </div>
        </div>

        {displayError && <Notice tone="error">{displayError}</Notice>}

        <button type="submit" disabled={!canSubmit} className={authPrimary}>
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="border-t-page" />
              Creating your account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-400">
        Already have an account?{" "}
        <Link href={signInHref} className={authLink}>
          Sign in
        </Link>
      </p>
    </>
  );
}
