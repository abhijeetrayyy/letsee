"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";

/**
 * When the site asks someone to slow down (lib/limits/guard answers 429),
 * say so in a sentence — once, not once per refused request — instead of
 * letting a dozen components fail quietly or show their own errors.
 *
 * It watches the browser's fetch for this site's /api answers only; Supabase
 * and TMDB images are other addresses and pass straight through. Downloads of
 * your data say their own thing on their row, so they're left alone.
 */
const QUIET_FOR_MS = 20_000;

export default function FairUseNotice() {
  useEffect(() => {
    const original = window.fetch;
    let lastShown = 0;
    const watched: typeof window.fetch = async (input, init) => {
      const res = await original(input, init);
      if (res.status !== 429) return res;
      try {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.href);
        if (url.origin === window.location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/account/export")) {
          const now = Date.now();
          if (now - lastShown > QUIET_FOR_MS) {
            lastShown = now;
            const said = await res.clone().json().then((j: { error?: string }) => j?.error).catch(() => null);
            toast(said || "You're going a bit fast. Try again in a moment.", { id: "fair-use", duration: 6000 });
          }
        }
      } catch {
        // Not ours to explain.
      }
      return res;
    };
    window.fetch = watched;
    return () => {
      if (window.fetch === watched) window.fetch = original;
    };
  }, []);
  return null;
}
