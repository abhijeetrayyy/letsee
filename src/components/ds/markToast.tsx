"use client";

import toast from "react-hot-toast";
import { Check } from "lucide-react";

/**
 * The one confirmation after a mark or a log: what happened, where the rest
 * lives, and Undo — then gone in a few seconds.
 *
 * The owner (10 Oct 2026): a tap should register, and say so briefly, not ask
 * for more ("please add to the diary"). So no "Add date" or "Add details"
 * button here any more; the hint says the details can be changed any time
 * from ⋯, and the toast clears itself quickly. Undo stays: it's how a mistap
 * costs nothing.
 */
export function markToast({ id, text, hint, undo }: { id?: string; text: string; hint?: string; undo?: () => void }) {
  toast.custom(
    (t) => (
      <div role="status" className="pointer-events-auto flex w-[min(92vw,26rem)] items-center gap-3 rounded-card border border-line-strong bg-overlay px-4 py-3 text-sm text-ink-0 shadow-2xl">
        <Check className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block">{text}</span>
          {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
        </span>
        {undo && (
          <button
            type="button"
            className="shrink-0 rounded-full px-3 py-1.5 font-medium text-ink-400 transition-colors hover:bg-hover hover:text-ink-0"
            onClick={() => {
              toast.dismiss(t.id);
              undo();
            }}
          >
            Undo
          </button>
        )}
      </div>
    ),
    // Long enough to read a line and reach Undo; short enough to be out of the way.
    { id, duration: hint ? 4000 : 3000 },
  );
}

/** Where a title's details live, said after marking it watched. */
export const DETAILS_HINT = {
  here: "Add when, who or stars any time from ⋯ below.",
  elsewhere: "Add when, who or stars any time from ⋯ on its page.",
} as const;
