import React from "react";

type SkeletonRowProps = {
  count?: number;
  variant?: "default" | "compact" | "detailed";
  className?: string;
};

export default function SkeletonRow({
  count = 5,
  variant = "default",
  className = "",
}: SkeletonRowProps) {
  const base = "animate-pulse bg-surface-800 rounded";

  const rows = Array.from({ length: count }, (_, i) => {
    if (variant === "compact") {
      return (
        <div key={i} className={`flex items-center gap-3 py-2 ${i < count - 1 ? "border-b border-surface-800/50" : ""}`}>
          <div className={`${base} w-8 h-8 rounded-lg shrink-0`} />
          <div className={`${base} h-4 flex-1 rounded`} />
        </div>
      );
    }

    if (variant === "detailed") {
      return (
        <div key={i} className={`flex gap-4 py-3 ${i < count - 1 ? "border-b border-surface-800/50" : ""}`}>
          <div className={`${base} w-12 h-16 rounded-lg shrink-0`} />
          <div className="flex-1 space-y-2">
            <div className={`${base} h-4 w-3/4 rounded`} />
            <div className={`${base} h-3 w-1/2 rounded`} />
            <div className={`${base} h-3 w-1/3 rounded`} />
          </div>
        </div>
      );
    }

    return (
      <div key={i} className={`flex items-center gap-3 py-3 ${i < count - 1 ? "border-b border-surface-800/50" : ""}`}>
        <div className={`${base} w-10 h-10 rounded-lg shrink-0`} />
        <div className="flex-1 space-y-2">
          <div className={`${base} h-4 w-2/3 rounded`} />
          <div className={`${base} h-3 w-1/2 rounded`} />
        </div>
      </div>
    );
  });

  return <div className={`space-y-1 ${className}`}>{rows}</div>;
}
