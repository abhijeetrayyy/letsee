"use client";

import { useState } from "react";
import Link from "@components/ui/AppLink";

/**
 * A comma-separated list of names where each name goes somewhere.
 *
 * Replaces the `.map(x => x.name).join(", ")` that the details grid used for
 * directors, creators, studios and networks. That join was doing more damage
 * than it looked: for production companies the ids were discarded a hundred
 * lines earlier to build the string, so the page physically could not link
 * them without changing how the data was prepared.
 *
 * The cap stays, because the details grid is a summary and eleven studios is
 * not one — but "+3 more" used to be a dead grey span. It named a number of
 * things and then refused to show them, on a page whose whole job is telling
 * you about this title, and there was nowhere else to look: the crew block
 * lists people, not companies. Now it opens.
 *
 * `useState` rather than the `<details>` the hero synopsis uses, and the reason
 * is word order. A `<summary>` must be the first child, so the control would
 * read "A, B, C less, D, E" once open — the toggle stranded in the middle of
 * its own sentence. A button can sit after the names it reveals. This renders
 * inside TitleFacts, which is already `"use client"`, so the state costs no new
 * boundary.
 */
export default function EntityLinks({
  items = [],
  href,
  max = 4,
  className = "",
}: {
  items?: { id: number; name: string }[];
  href: (item: { id: number; name: string }) => string;
  max?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const hidden = Math.max(0, items.length - max);
  const shown = expanded ? items : items.slice(0, max);

  return (
    <span className={className}>
      {shown.map((item, i) => (
        <span key={item.id}>
          <Link href={href(item)} className="transition-colors hover:text-brand-400">
            {item.name}
          </Link>
          {i < shown.length - 1 && ", "}
        </span>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="ml-1 text-surface-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-400"
        >
          {expanded ? "less" : `+${hidden} more`}
        </button>
      )}
    </span>
  );
}
