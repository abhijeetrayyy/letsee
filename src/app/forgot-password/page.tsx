"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) {
      setMessage({ type: "error", text: `Wait ${cooldown}s before requesting again.` });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/update-password`,
    });

    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("for security") || error.message.toLowerCase().includes("rate")) {
        setCooldown(COOLDOWN_SECONDS);
        setMessage({ type: "error", text: "Please wait 60 seconds before requesting another link." });
      } else {
        setMessage({ type: "error", text: error.message });
      }
      return;
    }

    setCooldown(COOLDOWN_SECONDS);
    setMessage({ type: "success", text: "Check your email for the reset link." });
  };

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
            Reset password
          </h1>
          <p className="text-neutral-400 text-sm mb-6">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-neutral-300 mb-1.5">
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading || cooldown > 0}
                placeholder="you@example.com"
                className="w-full rounded-lg bg-neutral-800 border border-neutral-600 px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-60"
              />
            </div>

            {message && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-200"
                    : message.type === "error"
                      ? "bg-red-500/10 border border-red-500/30 text-red-200"
                      : "bg-neutral-700/50 border border-neutral-600 text-neutral-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="border-t-white" />
                  Sending…
                </>
              ) : cooldown > 0 ? (
                `Request again in ${cooldown}s`
              ) : (
                "Send reset link"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-400">
            Back to{" "}
            <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
