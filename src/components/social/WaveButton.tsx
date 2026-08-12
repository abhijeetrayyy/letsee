"use client";

import { useEffect, useState } from "react";
import { Hand } from "lucide-react";
import toast from "react-hot-toast";

type WaveButtonProps = {
  targetUserId: string;
  targetUsername?: string;
  /** Skip the status fetch when the caller already knows. */
  initialWaved?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/**
 * The lowest-cost way to reach another person: one tap, no words.
 *
 * Everything else on LetSee asks you to compose something — a review, a
 * comment, a message. For a lot of people that's the barrier, so they lurk.
 * A wave says "I saw you and I'd talk" without making anyone go first.
 */
export default function WaveButton({
  targetUserId,
  targetUsername,
  initialWaved,
  size = "sm",
  className = "",
}: WaveButtonProps) {
  const [waved, setWaved] = useState(initialWaved ?? false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(initialWaved !== undefined);

  useEffect(() => {
    if (initialWaved !== undefined) return;
    let cancelled = false;
    fetch(`/api/wave?userId=${encodeURIComponent(targetUserId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setWaved(!!d.waved);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [targetUserId, initialWaved]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    const next = !waved;
    setWaved(next); // optimistic

    try {
      const res = next
        ? await fetch("/api/wave", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: targetUserId }),
          })
        : await fetch(`/api/wave?userId=${encodeURIComponent(targetUserId)}`, {
            method: "DELETE",
          });

      if (!res.ok) throw new Error(String(res.status));
      if (next) {
        toast.success(
          targetUsername ? `You waved at @${targetUsername}` : "Wave sent",
        );
      }
    } catch {
      setWaved(!next); // roll back
      toast.error("Couldn't send that wave.");
    } finally {
      setLoading(false);
    }
  };

  const sizeClass =
    size === "sm" ? "px-3 py-1.5 text-xs gap-1.5" : "px-4 py-2 text-sm gap-2";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || !ready}
      aria-pressed={waved}
      title={waved ? "Waved — tap to undo" : "Wave — no message needed"}
      className={`inline-flex items-center justify-center rounded-full font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 touch-manipulation ${sizeClass} ${
        waved
          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
          : "bg-surface-800 text-surface-300 border border-surface-700 hover:bg-surface-700 hover:text-white"
      } ${className}`}
    >
      <Hand className={`size-3.5 shrink-0 ${waved ? "" : "opacity-70"}`} />
      {waved ? "Waved" : "Wave"}
    </button>
  );
}
