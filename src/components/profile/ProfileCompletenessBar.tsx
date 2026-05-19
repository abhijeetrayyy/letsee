"use client";

import { useMemo } from "react";
import { CheckCircle2, Circle } from "lucide-react";

type CompletenessCheck = {
  key: string;
  label: string;
  done: boolean;
};

export default function ProfileCompletenessBar({
  hasAvatar, hasBanner, hasTagline, hasBio,
  tasteInFourFilled, hasFeaturedList, hasPinnedReview,
}: {
  hasAvatar: boolean; hasBanner: boolean; hasTagline: boolean; hasBio: boolean;
  tasteInFourFilled: boolean; hasFeaturedList: boolean; hasPinnedReview: boolean;
}) {
  const checks: CompletenessCheck[] = useMemo(
    () => [
      { key: "avatar", label: "Add a profile picture", done: hasAvatar },
      { key: "banner", label: "Add a banner image", done: hasBanner },
      { key: "tagline", label: "Write a tagline", done: hasTagline },
      { key: "bio", label: "Write a bio", done: hasBio },
      { key: "taste4", label: "Fill your Taste in 4", done: tasteInFourFilled },
      { key: "list", label: "Feature a list", done: hasFeaturedList },
      { key: "review", label: "Pin a review", done: hasPinnedReview },
    ],
    [hasAvatar, hasBanner, hasTagline, hasBio, tasteInFourFilled, hasFeaturedList, hasPinnedReview],
  );

  const done = checks.filter((c) => c.done).length;
  const total = checks.length;
  const pct = Math.round((done / total) * 100);
  const isComplete = done === total;

  if (isComplete) return null;

  const next = checks.find((c) => !c.done);

  return (
    <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-surface-300">Profile completeness</span>
        <span className="text-xs text-brand-400 font-semibold">{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <details className="group">
        <summary className="text-[11px] text-surface-500 cursor-pointer hover:text-surface-300 transition-colors select-none">
          {done}/{total} done — {next ? `Next: ${next.label}` : "All done!"}
        </summary>
        <div className="mt-2 space-y-1">
          {checks.map((c) => (
            <div key={c.key} className="flex items-center gap-2 text-[11px]">
              {c.done ? (
                <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
              ) : (
                <Circle className="w-3 h-3 text-surface-600 shrink-0" />
              )}
              <span className={c.done ? "text-surface-400 line-through" : "text-surface-500"}>{c.label}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
