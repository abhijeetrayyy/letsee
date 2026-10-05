"use client";

import { useEffect, useState } from "react";

/**
 * The email typed on one auth page, offered on the next: signing up with an
 * address that already has an account sends you to sign in, and you shouldn't
 * have to type it again. Kept for this tab only, never in the address bar.
 */
const KEY = "letsee:auth-email";

export function rememberAuthEmail(email: string) {
  try {
    window.sessionStorage.setItem(KEY, email.trim());
  } catch {
    // Not remembered; the field is just empty.
  }
}

export function readAuthEmail(): string {
  try {
    return window.sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** Seconds left before another email may be asked for; Supabase allows one a minute. */
export function useCooldown(initial = 0): [number, (seconds?: number) => void] {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, (seconds = 60) => setLeft(seconds)];
}
