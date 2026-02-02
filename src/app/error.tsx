"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="bg-neutral-700 text-white w-full h-screen flex justify-center items-center flex-col gap-3 px-4">
      <p>Sorry, something went wrong.</p>
      <div className="w-full max-w-lg rounded-md bg-neutral-800 px-4 py-3 text-sm text-neutral-200">
        <p className="font-semibold">Why this happened</p>
        <p className="mt-1">
          {error?.message || "An unexpected error occurred while loading data."}
        </p>
        {error?.digest && (
          <p className="mt-2 text-xs text-neutral-400">
            Error ID: {error.digest}
          </p>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          If this keeps happening, the TMDB API or network may be unavailable.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="px-3 py-2 bg-neutral-600 rounded-md hover:bg-neutral-500"
        >
          Try again
        </button>
        <Link
          href="/login"
          className="px-3 py-2 bg-neutral-600 rounded-md hover:bg-neutral-500"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
