"use client";

import React from "react";

type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "size-5",
  md: "size-8",
  lg: "size-12",
};

export function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-line-strong border-t-accent-strong ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl bg-overlay/50 border border-line-strong/50 overflow-hidden animate-pulse">
      <div className="aspect-2/3 bg-hover/50" />
      <div className="p-3 space-y-2">
        <div className="h-3.5 bg-hover/50 rounded w-3/4" />
        <div className="h-3 bg-hover/50 rounded w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonRow({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-32 sm:w-40 rounded-xl bg-overlay/50 border border-line-strong/50 overflow-hidden animate-pulse"
        >
          <div className="aspect-2/3 bg-hover/50" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 bg-hover/50 rounded w-3/4" />
            <div className="h-3 bg-hover/50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-ink-500 animate-pulse">Loading…</p>
    </div>
  );
}
