import Link from "next/link";

/**
 * A comma-separated list of names where each name goes somewhere.
 *
 * Replaces the `.map(x => x.name).join(", ")` that the details grid used for
 * directors, creators, studios and networks. That join was doing more damage
 * than it looked: for production companies the ids were discarded a hundred
 * lines earlier to build the string, so the page physically could not link
 * them without changing how the data was prepared.
 *
 * Caps the list rather than printing eleven studios, because the details grid
 * is a summary — the full crew lives in its own block.
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
  if (items.length === 0) return null;

  const shown = items.slice(0, max);
  const remaining = items.length - shown.length;

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
      {remaining > 0 && <span className="text-surface-500"> +{remaining} more</span>}
    </span>
  );
}
