"use client";

import { useEffect, useRef, useState } from "react";
import { lockScroll } from "@/lib/ui/scrollLock";
import { createPortal } from "react-dom";
import { Play, X } from "lucide-react";

/**
 * The trailer, in sight.
 *
 * It was the fifth item of the "more" menu, which is to say nobody deciding
 * whether to watch something found it — and it is the one thing on the page
 * made for exactly that decision. Now it is a button at the top of the hero,
 * opposite Back, where it costs no height, and the menu is one item shorter.
 *
 * The player is a dialog: Escape closes it, the close button takes focus, the
 * page behind doesn't scroll, and focus goes back to the button afterwards.
 * It is portalled to <body>: the hero band is its own stacking context
 * (`isolate z-10`), and from inside it the app's bars drew over the player.
 * Two focus guards keep Tab inside it, including tabbing out of the player —
 * whose keys go to YouTube, not us, so Escape can't be heard from in there;
 * Tab back to Close, or tap outside. The video is sized to the screen's
 * height too, so Close stays on screen with a phone on its side.
 */
export default function Trailer({ videoKey, title }: { videoKey: string; title: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-page/60 px-3.5 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-strong backdrop-blur-sm transition-colors hover:bg-hover"
      >
        <Play className="size-3.5 fill-current" aria-hidden />
        Trailer
      </button>
      {open &&
        createPortal(
          <TrailerDialog
            videoKey={videoKey}
            title={title}
            onClose={() => {
              setOpen(false);
              button.current?.focus();
            }}
          />,
          document.body,
        )}
    </>
  );
}

function TrailerDialog({ videoKey, title, onClose }: { videoKey: string; title: string; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    close.current?.focus();
    const unlock = lockScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const frame = useRef<HTMLIFrameElement>(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} trailer`}
      data-theme="dark"
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-page/95 px-4 py-4"
      onClick={onClose}
    >
      {/* Focus guards: wrapping out of either end comes back in at the other. */}
      <span tabIndex={0} aria-hidden onFocus={() => frame.current?.focus()} />
      <div className="w-full max-w-app" style={{ maxWidth: "min(var(--container-app, 72rem), calc((100dvh - 6rem) * 16 / 9))" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-end">
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-strong hover:bg-hover hover:text-ink-0"
          >
            <X className="size-4" aria-hidden />
            Close
          </button>
        </div>
        <div className="aspect-video overflow-hidden rounded-xl bg-raised">
          <iframe
            ref={frame}
            title={`${title} trailer`}
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
      <span tabIndex={0} aria-hidden onFocus={() => close.current?.focus()} />
    </div>
  );
}
