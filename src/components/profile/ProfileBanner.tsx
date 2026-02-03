"use client";

import { useState } from "react";

type ProfileBannerProps = {
  src: string;
  className?: string;
};

/** Renders banner image with fallback to gradient on load error. */
export default function ProfileBanner({ src, className = "" }: ProfileBannerProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src || src.trim() === "") {
    return (
      <div
        className={`absolute inset-0 bg-gradient-to-b from-neutral-800 via-neutral-800 to-neutral-900 ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <>
      <img
        src={src}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    </>
  );
}
