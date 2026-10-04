"use client";

import toast from "react-hot-toast";
import { shareOrCopy } from "@/lib/share";

/**
 * Share or copy a link that was just made. Safari only lets a page share or
 * write the clipboard straight after a tap, and making the link takes a round
 * trip — so when the first try is refused, a toast offers the link again
 * behind a fresh tap, and as a last resort shows it to copy by hand.
 */
export async function offerLink(input: { title: string; text?: string; url: string }, copied: string): Promise<"shared" | "copied" | "cancelled" | "offered"> {
  const first = await shareOrCopy(input);
  if (first === "copied") toast.success(copied);
  if (first !== "failed") return first;
  toast(
    (t) => (
      <span className="flex items-center gap-3">
        Your link is ready
        <button
          type="button"
          className="rounded-full bg-action px-3 py-1 font-medium text-on-action"
          onClick={async () => {
            toast.dismiss(t.id);
            const again = await shareOrCopy(input);
            if (again === "copied") toast.success(copied);
            if (again === "failed") toast(input.url, { duration: 20000 });
          }}
        >
          Copy it
        </button>
      </span>
    ),
    { duration: 15000 },
  );
  return "offered";
}
