"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "letsee_rating_scale_notice_dismissed";

/**
 * "Your ratings didn't change, the display did."
 *
 * Nothing was migrated — a stored 7 was "7/10" and is now 3½ stars, the same
 * judgement written two ways. But a scale that changes under you *reads* as
 * data loss whether or not anything was lost, and someone who deliberately
 * used the granularity of 1–10 will notice immediately. One line, said once,
 * costs almost nothing and answers the question before it's asked.
 *
 * Dismissal lives in localStorage rather than on the user row: it's a one-time
 * cosmetic notice, and adding a column plus a migration for it would be
 * disproportionate. The trade is that it can reappear on a second device,
 * which for a single sentence is acceptable.
 */
export default function RatingScaleNotice() {
  const [show, setShow] = useState(false);

  // Read after mount — localStorage isn't available during SSR, and reading it
  // in useState would desync the first client render from the server's HTML.
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      // Private browsing or storage disabled: just don't nag.
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Not worth surfacing — hiding it for this session is enough.
    }
    setShow(false);
  };

  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-surface-800 bg-surface-900/60 px-3 py-2">
      <p className="text-xs leading-relaxed text-surface-400">
        Ratings are stars now. Nothing changed in your history — your old
        scores just read as half-stars, so an 8 is 4 stars.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-auto shrink-0 rounded p-0.5 text-surface-500 hover:text-surface-300 transition"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
