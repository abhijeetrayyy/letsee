"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type FetchErrorProps = {
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function FetchError({
  message = "Something went wrong. Please try again.",
  onRetry,
  className = "",
}: FetchErrorProps) {
  return (
    <div
      className={`rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-red-200 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-300">Couldn&apos;t load content</p>
          <p className="mt-1 text-sm text-red-400/80">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
