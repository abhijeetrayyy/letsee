"use client";

import { useState } from "react";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 128,
};

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type AvatarProps = {
  /** Image URL, if any. Falsy, empty, or a URL that fails to load all fall back to initials. */
  src?: string | null;
  /** Username or display name — used for initials and the fallback color. */
  name: string;
  size?: AvatarSize | number;
  className?: string;
};

/**
 * Single shared avatar renderer — a person's face. Never shows a broken-image
 * icon: a missing or failing `src` falls back to their initials on a quiet
 * graphite disc with a hairline ring.
 *
 * No colour per person. The first redesign pass tried one; on a screen people
 * open every night it read as a toy. Faces carry identity better than any
 * colour (docs/design/SYSTEM.md §1.4), so the fallback is deliberately plain
 * and the product asks for a photo instead.
 */
export default function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const px = typeof size === "number" ? size : SIZE_PX[size];
  const trimmedSrc = src?.trim();
  const showImage = !!trimmedSrc && !failed;

  if (showImage) {
    return (
      <img loading="lazy" decoding="async"
        src={trimmedSrc}
        alt={name}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover shrink-0 ring-1 ring-line-strong ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`rounded-full flex items-center justify-center font-semibold text-ink-0 bg-hover ring-1 ring-line-strong shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        fontSize: Math.max(10, Math.round(px * (px < 28 ? 0.46 : 0.38))),
      }}
    >
      {/* Two letters don't fit a small face, and overlap into noise in a group. */}
      {px < 28 ? initialsOf(name).slice(0, 1) : initialsOf(name)}
    </div>
  );
}
