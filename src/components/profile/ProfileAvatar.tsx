"use client";

import { useState } from "react";

const DEFAULT_AVATAR = "/avatar.svg";

type ProfileAvatarProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
};

/** Renders avatar with fallback to default on load error (avoids broken image for invalid/blocked URLs). */
export default function ProfileAvatar({
  src,
  alt,
  className = "",
  width,
  height,
}: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);
  const effectiveSrc =
    failed || !src || src.trim() === "" ? DEFAULT_AVATAR : src;

  const handleError = () => {
    if (effectiveSrc !== DEFAULT_AVATAR) setFailed(true);
  };

  return (
    <img
      width={width ?? 144}
      height={height ?? 144}
      className={className}
      src={effectiveSrc}
      alt={alt}
      onError={handleError}
    />
  );
}
