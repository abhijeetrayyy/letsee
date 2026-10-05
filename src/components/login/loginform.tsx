"use client";

import Link from "next/link";
import React, { useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Eye, EyeOff } from "lucide-react";
import { Notice, authInput, authLink, authPrimary } from "@components/auth/AuthShell";

type LoginFormProps = {
  email: string;
  onEmailChange: (email: string) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string;
  info?: string;
  /** Under the messages: a way to act on them (send the confirmation link again). */
  extra?: React.ReactNode;
  signUpHref: string;
};

export default function LoginForm({ email, onEmailChange, onLogin, loading, error, info, extra, signUpHref }: LoginFormProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = Boolean(email.trim() && password && !loading);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onLogin(email.trim(), password);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-ink-300">
            Email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            disabled={loading}
            className={authInput}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="login-password" className="block text-sm font-medium text-ink-300">
              Password
            </label>
            <Link href="/forgot-password" className="text-sm font-medium text-accent transition-colors hover:text-accent-soft">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className={`${authInput} pr-12`}
              placeholder="Your password"
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

        {info && <Notice tone="info">{info}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {extra}

        <button type="submit" disabled={!canSubmit} className={authPrimary}>
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="border-t-page" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-400">
        New to letsee?{" "}
        <Link href={signUpHref} className={authLink}>
          Create an account
        </Link>
      </p>
    </>
  );
}
