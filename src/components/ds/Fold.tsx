import { ChevronDown } from "lucide-react";

/**
 * A section closed by default, with its count in the header
 * (docs/design/SYSTEM.md §8, Titles: `Fold`).
 *
 * Reference material — full credits, keywords, release dates, clips — is
 * folded in place rather than moved behind a tab or another page: people miss
 * what sits behind horizontal tabs and subpages (research/05 §2), and a fold
 * keeps it one tap away on the same page. Native `<details>`, so it works
 * without JavaScript and is announced as a disclosure.
 */
export default function Fold({
  title,
  count,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  /** One line under the title saying what is inside. */
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-card border border-line-strong bg-raised/40">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-ink-0">{title}</span>
          {hint && <span className="block text-sm text-ink-500">{hint}</span>}
        </span>
        {count != null && <span className="font-mono text-xs tabular-nums text-ink-500">{count}</span>}
        <ChevronDown aria-hidden className="size-4 text-ink-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line px-4 pb-5 pt-4 sm:px-5">{children}</div>
    </details>
  );
}
