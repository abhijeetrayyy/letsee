"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A `Fold` whose contents are not mounted until it is first opened.
 *
 * For sections that fetch on mount — a profile's full library, its diary, its
 * stats. A plain `<details>` renders its children while closed, so every
 * folded section would still run its queries on page load; this one runs them
 * when someone asks to see them, and keeps them once opened.
 *
 * With an `id`, a fold is also an address: `…/profile/ray#diary` opens the
 * diary and brings it into view, and opening a fold by hand writes its anchor
 * into the address bar (`replaceState` — no navigation, no request), so what
 * you're looking at is what you share. Closing it takes the anchor back off.
 * That is PAGES.md's "separate URLs for the profile's sub-pages", without a
 * route per section and without making the profile any less cacheable.
 */
export default function LazyFold({
  title,
  hint,
  id,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  /** Anchor for this fold (`#id`): opens it on arrival and is written on open. */
  id?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [opened, setOpened] = useState(defaultOpen);
  const ref = useRef<HTMLDetailsElement>(null);
  /** A fold open from the start fires one toggle as it mounts: that one isn't someone opening it. */
  const mountToggle = useRef(defaultOpen);

  useEffect(() => {
    if (!id) return;
    // Arriving with the anchor: open. Getting there is ScrollToTop's job,
    // because what's above this fold may still be loading.
    const openFromHash = (scroll: boolean) => {
      if (window.location.hash !== `#${id}` || !ref.current) return;
      ref.current.open = true;
      setOpened(true);
      if (scroll) ref.current.scrollIntoView({ block: "start" });
    };
    openFromHash(false);
    const onHash = () => openFromHash(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id]);

  return (
    <details
      ref={ref}
      id={id}
      open={defaultOpen}
      onToggle={(e) => {
        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
        if (isOpen) setOpened(true);
        if (mountToggle.current) {
          mountToggle.current = false;
          if (isOpen) return;
        }
        if (!id) return;
        const here = window.location.hash === `#${id}`;
        // `null` state: Next's patched replaceState then records the new URL in
        // its router too; passing its own state through skips that, and the
        // next refresh would put the old address back.
        if (isOpen && !here) window.history.replaceState(null, "", `#${id}`);
        if (!isOpen && here) window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }}
      className="group scroll-mt-20 rounded-card border border-line-strong bg-raised/40"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-ink-0">{title}</span>
          {hint && <span className="block text-sm text-ink-500">{hint}</span>}
        </span>
        <ChevronDown aria-hidden className="size-4 text-ink-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4 pb-5 pt-4 sm:px-5">{opened ? children : null}</div>
    </details>
  );
}
