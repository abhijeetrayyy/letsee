"use client";
import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { LogOutIcon } from "lucide-react";

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
      localStorage.clear();
      sessionStorage.clear();
      router.push("/login");
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Sign-out failed";
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
        className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
          isLoading
            ? "bg-hover text-ink-400 cursor-not-allowed"
            : "bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 hover:border-danger/30"
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
            <LogOutIcon className="size-4" />
            Sign out
          </>
        )}
      </button>
    </div>
  );
};

export default SignOut;
