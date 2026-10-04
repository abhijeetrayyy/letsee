"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import PassSheet from "@components/ds/PassSheet";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import type { PassTitle } from "@/lib/db/passes";

/**
 * **Pass to…** on a title (docs/design/RETHINK.md §6). Signed out, it is not
 * shown: the one action a visitor gets is Sign in to log.
 */
export default function PassToButton({ title }: { title: PassTitle }) {
  const { user, status } = useAuth();
  const [open, setOpen] = useState(false);
  if (status !== "ok" || !user) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-base font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover sm:px-5"
      >
        <Send className="size-4" aria-hidden />
        <span className="sm:hidden">Pass</span>
        <span className="hidden sm:inline">Pass to…</span>
      </button>
      <PassSheet open={open} onClose={() => setOpen(false)} me={user.id} title={title} />
    </>
  );
}
