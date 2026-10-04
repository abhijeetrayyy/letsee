import { useId } from "react";

/**
 * The mark: two circles overlapping, the overlap filled (docs/design/SYSTEM.md
 * §2, "Two people together"). Two people, and the thing between them.
 */
export default function Mark({ withName = true, size = "md", className = "" }: { withName?: boolean; size?: "md" | "lg"; className?: string }) {
  const clip = useId();
  return (
    <span className={`inline-flex items-center gap-2 text-ink-0 ${className}`}>
      <svg viewBox="0 0 26 18" className={`${size === "lg" ? "h-8 w-11.5" : "h-4.5 w-6.5"} shrink-0`} aria-hidden>
        <defs>
          <clipPath id={clip}>
            <circle cx="9" cy="9" r="7.25" />
          </clipPath>
        </defs>
        <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="17" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="17" cy="9" r="7.25" fill="currentColor" clipPath={`url(#${clip})`} />
      </svg>
      {withName && <span className="font-display text-xl font-medium tracking-tight">letsee</span>}
    </span>
  );
}
