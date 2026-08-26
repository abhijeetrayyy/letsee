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

/** Gradient pairs pulled from the app's existing accent palette (brand/gold + a few extras for variety). */
const PALETTE: [string, string][] = [
  ["#22c55e", "#16a34a"], // brand green
  ["#f5c518", "#e6a817"], // accent gold
  ["#3b82f6", "#1d4ed8"], // blue
  ["#a855f7", "#7e22ce"], // purple
  ["#ef4444", "#b91c1c"], // red
  ["#f97316", "#c2410c"], // orange
  ["#14b8a6", "#0f766e"], // teal
  ["#ec4899", "#be185d"], // pink
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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
 * Single shared avatar renderer. Never shows a broken-image icon: a missing
 * or failing `src` always falls back to a deterministic, colored initials
 * badge instead — the same fallback everywhere it's used.
 */
export default function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const px = typeof size === "number" ? size : SIZE_PX[size];
  const trimmedSrc = src?.trim();
  const showImage = !!trimmedSrc && !failed;
  const [from, to] = PALETTE[hashString(name || "?") % PALETTE.length];

  if (showImage) {
    return (
      <img loading="lazy" decoding="async"
        src={trimmedSrc}
        alt={name}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name}
      className={`rounded-full flex items-center justify-center font-semibold text-white shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: Math.max(10, Math.round(px * 0.4)),
      }}
    >
      {initialsOf(name)}
    </div>
  );
}
