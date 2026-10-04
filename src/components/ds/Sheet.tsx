"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A sheet: from the bottom on a phone, a centred panel on wider screens
 * (docs/design/SYSTEM.md §8, Input and gates).
 *
 * Closes on the close button, Escape, a tap on the scrim, and the browser's
 * Back on phones is left to the caller's routing. Focus moves into the sheet
 * when it opens and returns to whatever opened it when it closes. The page
 * behind does not scroll while it is open.
 */
/**
 * Open sheets, newest last. A sheet opened from inside another (Log it → Add
 * details) sits on top; Escape closes only that one, and when it closes focus
 * goes back to the sheet beneath if what opened it is gone (a toast's button).
 */
const openSheets: HTMLElement[] = [];

export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const descId = useId();

  // The latest onClose, read at the moment of closing. Callers pass inline
  // functions; with onClose in the effect's dependencies, every re-render of
  // the caller re-ran it — re-locking the scroll and moving focus back to the
  // panel, out of whatever field someone was typing in.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const self = panel.current;
    opener.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (self) openSheets.push(self);
    self?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openSheets[openSheets.length - 1] === self) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const at = self ? openSheets.indexOf(self) : -1;
      if (at >= 0) openSheets.splice(at, 1);
      document.body.style.overflow = previousOverflow;
      const back = opener.current as HTMLElement | null;
      if (back?.isConnected) back.focus?.();
      else openSheets[openSheets.length - 1]?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-page/70" tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className="relative max-h-[92dvh] w-full max-w-sheet overflow-y-auto overscroll-contain rounded-t-sheet border border-line-strong bg-overlay px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl focus:outline-none sm:rounded-sheet sm:pb-6"
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-input sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl text-ink-0">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-ink-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:bg-hover hover:text-ink-0"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
