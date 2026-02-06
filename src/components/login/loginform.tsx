"use client";

import Link from "next/link";
import React, { useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

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
    <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-3 sm:px-4 py-6 sm:py-10">
      <div className="w-full max-w-md min-w-0">
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
            Welcome back
          </h1>
          <p className="text-neutral-400 text-sm mb-6">
            Sign in with your email to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-neutral-300 mb-1.5"
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
                className="w-full min-h-[44px] rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-neutral-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full min-h-[44px] rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
                placeholder="••••••••"
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                <Link
                  href="/forgot-password"
                  className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800 text-indigo-600 focus:ring-indigo-500"
              />
              Show password
            </label>

            {info && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200">
                {info}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full min-h-[48px] rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 touch-manipulation"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="border-t-white" />
                  Signing in…
                </>
              ) : (
                "Log in"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium text-indigo-400 hover:text-indigo-300"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
