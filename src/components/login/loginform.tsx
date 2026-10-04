"use client";

import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import React, { useState } from "react";
import Mark from "@components/ds/Mark";
import InviteBanner from "@components/doors/InviteBanner";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Film, Eye, EyeOff } from "lucide-react";

type LoginFormProps = {
  onLogin: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string;
  info?: string;
};

export default function LoginForm({
  onLogin,
  loading,
  error,
  info,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = Boolean(email.trim() && password && !loading);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onLogin(email.trim(), password);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-page px-4 py-10">
      <div className="relative w-full max-w-read">
        <Link href="/" aria-label="letsee" className="mb-10 inline-flex">
          <Mark withName={false} size="lg" />
        </Link>

        <div>
          <InviteBanner />
          <div className="mb-6">
            <h1 className="text-4xl leading-tight text-ink-0">Welcome back.</h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-ink-300 mb-2"
              >
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl bg-overlay/60 border border-line-strong/50 px-4 py-3 text-ink-0 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-accent-strong/40 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-ink-300"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-accent hover:text-accent-soft transition-colors"
                >
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
                  className="w-full rounded-xl bg-overlay/60 border border-line-strong/50 px-4 py-3 pr-12 text-ink-0 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-accent-strong/40 transition-all"
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
            </div>

            {info && (
              <div role="status" className="rounded-xl bg-action/10 border border-accent-strong/20 px-4 py-3 text-sm text-accent-soft flex items-start gap-2">
                <span aria-hidden className="mt-0.5 shrink-0">✉️</span>
                {info}
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
                {error}
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
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-line text-center">
            <p className="text-sm text-ink-400 mt-5">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-accent underline decoration-line-input underline-offset-4 hover:text-accent-soft transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
