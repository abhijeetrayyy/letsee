"use client";

import { Check, LoaderCircle, Target } from "lucide-react";
import { useKeptSet } from "@components/sets/useKeptSet";
import type { SetRef } from "@/lib/people/sets";

/**
 * Keep as a set (docs/IDEAS_2026-10.md §2.1): a list, or a person's work in
 * one role, chosen to work through — its progress then shows where it lives
 * and on your profile. One tap on, one tap off, with Undo.
 */
export default function KeepSet({
  setRef,
  name,
  imageUrl,
  label = "Keep as a set",
  className = "",
}: {
  setRef: SetRef;
  name: string;
  imageUrl: string | null;
  label?: string;
  className?: string;
}) {
  const { signedIn, kept, busy, toggle } = useKeptSet(setRef, name, imageUrl);
  if (!signedIn) return null;
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={kept}
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60 ${className} ${
        kept ? "bg-ink-0 text-page" : "text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover"
      }`}
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : kept ? <Check className="size-4" aria-hidden /> : <Target className="size-4" aria-hidden />}
      {kept ? "One of your sets" : label}
    </button>
  );
}
