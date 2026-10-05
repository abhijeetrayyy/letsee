"use client";
import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { LogOutIcon } from "lucide-react";
import { THEME_KEY } from "@/lib/theme";

const SignOut: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
      // Everything this device kept for you goes — except how you like the
      // screen to look, which isn't yours more than the device's, and wiping it
      // flashed the next person's page into the wrong theme.
      const theme = (() => {
        try {
          return localStorage.getItem(THEME_KEY);
        } catch {
          return null;
        }
      })();
      try {
        localStorage.clear();
        sessionStorage.clear();
        if (theme) localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Storage refused; signing out has still happened.
      }
      router.push("/login");
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error && /fetch|network/i.test(err.message)
        ? "Couldn't reach letsee to sign out. Check your connection and try again."
        : "Signing out didn't work. Try again.";
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return (
    <div className="w-full">
      <button
        onClick={handleSignOut}
        disabled={isLoading}
        type="button"
        // A row like the menu's others, in the danger colour — not a pink slab
        // the full width of the menu (it overflowed it).
        className={`flex h-10 w-full items-center gap-3 rounded-control px-3 text-left text-sm font-medium transition-colors ${
          isLoading ? "cursor-not-allowed text-ink-400" : "text-danger hover:bg-danger/10"
        }`}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Signing out…
          </>
        ) : (
          <>
            <LogOutIcon className="size-4" aria-hidden />
            Sign out
          </>
        )}
      </button>
    </div>
  );
};

export default SignOut;
