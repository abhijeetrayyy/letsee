"use client";

import React from "react";

type FetchErrorProps = {
  message?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * Consistent error + retry UX for failed fetches.
 */
export function FetchError({
  message = "Something went wrong. Please try again.",
  onRetry,
  className = "",
}: FetchErrorProps) {
  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-100 ${className}`}
      role="alert"
    >
      <p className="font-semibold">Couldn&apos;t load content</p>
      <p className="mt-1 text-sm text-amber-200">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
