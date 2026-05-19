import React from "react";

type SkeletonCardProps = {
  variant?: "poster" | "wide" | "avatar";
  className?: string;
};

export default function SkeletonCard({
  variant = "poster",
  className = "",
}: SkeletonCardProps) {
  const base = "animate-pulse bg-surface-800 rounded-xl";

  if (variant === "poster") {
    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <div className={`${base} w-full aspect-[2/3] rounded-2xl`} />
        <div className="px-1 space-y-2">
          <div className={`${base} h-4 w-3/4 rounded`} />
          <div className={`${base} h-3 w-1/2 rounded`} />
        </div>
      </div>
    );
  }

  if (variant === "wide") {
    return (
      <div className={`flex gap-4 ${className}`}>
        <div className={`${base} w-24 h-36 rounded-lg shrink-0`} />
        <div className="flex-1 space-y-3 py-1">
          <div className={`${base} h-5 w-2/3 rounded`} />
          <div className={`${base} h-4 w-full rounded`} />
          <div className={`${base} h-4 w-1/2 rounded`} />
        </div>
      </div>
    );
  }

  if (variant === "avatar") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`${base} w-10 h-10 rounded-full shrink-0`} />
        <div className="space-y-2">
          <div className={`${base} h-4 w-24 rounded`} />
          <div className={`${base} h-3 w-16 rounded`} />
        </div>
      </div>
    );
  }

  return <div className={`${base} w-full h-48 ${className}`} />;
}
