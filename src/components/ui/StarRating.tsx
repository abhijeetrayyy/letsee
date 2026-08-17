"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { formatStars, scoreToStars, starsToScore } from "@/utils/ratingScale";

const SIZES = {
  sm: { star: "size-3.5", gap: "gap-0.5" },
  md: { star: "size-5", gap: "gap-1" },
  lg: { star: "size-7", gap: "gap-1" },
  xl: { star: "size-9", gap: "gap-1.5" },
} as const;

type Props = {
  /** Stored score, 1–10. Null means unrated. */
  value: number | null;
  /**
   * Omit for a read-only display. Receives a stored score, 1–10, or `null`
   * when the current value is tapped again and `allowClear` is set.
   */
  onChange?: (score: number | null) => void;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  /** Screen-reader context, e.g. the title being rated. */
  label?: string;
  /**
   * Tapping the segment that is already selected unsets the rating.
   *
   * Only safe where the caller actually erases the score everywhere it was
   * mirrored — see `mirrorToLegacy`. A clear that leaves the old number in the
   * community histogram is worse than no clear at all.
   */
  allowClear?: boolean;
};

/**
 * Five stars, half steps.
 *
 * Input is ten buttons — two invisible halves per star — rather than a slider
 * or a custom pointer handler. That costs nothing visually and means the
 * control is keyboard-navigable and screen-reader-legible for free, with each
 * option announcing the rating it sets.
 *
 * The value it emits is the *stored* 1–10 score, so nothing downstream of this
 * component has to know the display scale changed.
 */
export default function StarRating({
  value,
  onChange,
  size = "md",
  disabled = false,
  label,
  allowClear = false,
}: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const readOnly = !onChange;
  const shown = hover ?? value ?? 0;
  const stars = scoreToStars(shown);
  const dims = SIZES[size];

  if (readOnly) {
    return (
      <span
        className={`inline-flex items-center ${dims.gap}`}
        title={value != null ? `${formatStars(value)} out of 5` : undefined}
        aria-label={value != null ? `Rated ${formatStars(value)} out of 5` : "Not rated"}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <StarGlyph key={i} index={i} stars={stars} className={dims.star} />
        ))}
      </span>
    );
  }

  return (
    <span
      className={`relative inline-flex items-center ${dims.gap}`}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-flex">
          <StarGlyph index={i} stars={stars} className={dims.star} />
          {/* Two hit targets per star: left half sets x.5, right half sets x. */}
          {[0, 1].map((half) => {
            const score = starsToScore(i - 1 + (half === 0 ? 0.5 : 1));
            const clears = allowClear && value === score;
            return (
              <button
                key={half}
                type="button"
                disabled={disabled}
                onClick={() => onChange(clears ? null : score)}
                onMouseEnter={() => setHover(score)}
                onFocus={() => setHover(score)}
                onBlur={() => setHover(null)}
                aria-label={
                  clears
                    ? "Clear rating"
                    : `${formatStars(score)} out of 5${label ? ` for ${label}` : ""}`
                }
                className={`absolute inset-y-0 w-1/2 cursor-pointer rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed ${
                  half === 0 ? "left-0" : "right-0"
                }`}
              />
            );
          })}
        </span>
      ))}
    </span>
  );
}

/**
 * One star, filled 0%, 50% or 100%.
 *
 * The half state is a clipped overlay rather than a separate "half star" icon,
 * so the filled and empty halves always align exactly.
 */
function StarGlyph({
  index,
  stars,
  className,
}: {
  index: number;
  stars: number;
  className: string;
}) {
  const fill = Math.min(1, Math.max(0, stars - (index - 1)));

  return (
    <span className={`relative inline-block ${className}`}>
      <Star className={`${className} absolute inset-0 text-surface-600`} strokeWidth={1.5} />
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${fill * 100}%` }}
          aria-hidden
        >
          <Star
            className={`${className} text-accent-gold`}
            fill="currentColor"
            strokeWidth={1.5}
          />
        </span>
      )}
    </span>
  );
}
