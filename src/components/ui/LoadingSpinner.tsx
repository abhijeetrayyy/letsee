"use client";

import React from "react";

type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "size-6",
  md: "size-10",
  lg: "size-12",
};

/**
 * Reusable loading spinner for consistent UX.
 */
export function LoadingSpinner({
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-neutral-600 border-t-white ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
