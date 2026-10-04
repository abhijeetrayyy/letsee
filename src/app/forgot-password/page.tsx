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
    <div className="min-h-screen flex flex-col justify-center items-center bg-page px-4 py-10">
      <div className="w-full max-w-sheet">
        <div className="text-center mb-8">
          <Link
            href="/app"
            className="text-2xl font-bold text-ink-0 hover:text-ink-300 transition-colors"
          >
            Let&apos;s See
          </Link>
          <p className="text-ink-400 mt-1 text-sm">Social media for cinema.</p>
        </div>

        <div className="rounded-2xl border border-line-strong/60 bg-raised/80 p-6 sm:p-8 shadow-xl">
          <h1 className="text-xl sm:text-2xl font-medium text-ink-0 mb-1">
            Reset password
          </h1>
          <p className="text-ink-400 text-sm mb-6">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-ink-300 mb-1.5">
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
                className="w-full rounded-lg bg-overlay border border-line-input px-4 py-3 text-ink-0 placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent disabled:opacity-60"
              />
            </div>

            {message && (
              <div
                role={message.type === "error" ? "alert" : "status"}
                className={`rounded-lg px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "bg-ink-0/10 border border-ink-0/30 text-ink-100"
                    : message.type === "error"
                      ? "bg-danger/10 border border-danger/30 text-danger"
                      : "bg-hover/50 border border-line-input text-ink-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full rounded-lg bg-active py-3 font-semibold text-ink-0 hover:bg-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

          <p className="mt-6 text-center text-sm text-ink-400">
            Back to{" "}
            <Link href="/login" className="font-medium text-ink-300 hover:text-ink-200">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
