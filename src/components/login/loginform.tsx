"use client";

import Link from "next/link";
import React, { useState } from "react";
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
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-950 px-4 py-10">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-500/8 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/6 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: "1s" }} />
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
            Social film journal for cinephiles
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-surface-900/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/30">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">
              Welcome back
            </h1>
            <p className="text-surface-400 text-sm">
              Sign in to continue your cinematic journey
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-surface-300 mb-2"
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
                className="w-full rounded-xl bg-surface-800/60 border border-surface-700/50 px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40 transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-surface-300"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
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
            </div>

            {info && (
              <div className="rounded-xl bg-brand-500/10 border border-brand-500/20 px-4 py-3 text-sm text-brand-300 flex items-start gap-2">
                <span className="mt-0.5 shrink-0">✉️</span>
                {info}
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
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
                  <LoadingSpinner size="sm" className="border-t-surface-950" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-sm text-surface-400">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-brand-400 hover:text-brand-300 transition-colors"
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
