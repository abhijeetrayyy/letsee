"use client";

import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";

/**
 * "Seen 3 of 46."
 *
 * Completion motivates on a bounded set and resumption applies to started
 * things; an unbounded backlog demoralises (Carey 2008; McIntosh & Schmeichel
 * 2004; Ghibellini & Meier 2025). A filmography and a friend's list are
 * bounded sets. This is the quiet counter, never a badge and never a
 * percentage of a person — the pattern FranchiseStrip already had.
 *
 * "Seen" is the app's rule: every status except "want to watch". Refuses to
 * render for a set of one, where "1 of 1" is not progress.
 */
export default function SeenOf({
  items,
  noun = "titles",
  className = "",
}: {
  items: { id: string | number; type: string }[];
  noun?: string;
  className?: string;
}) {
  const { getStatus, isAuthenticated } = useMediaInteraction();
  if (!isAuthenticated || items.length < 2) return null;

  const seen = items.filter((it) => {
    const s = getStatus(String(it.id), it.type === "tv" ? "tv" : "movie");
    return !!s && s !== "watchlist";
  }).length;
  if (seen === 0) return null;

  return (
    <p className={`text-sm text-surface-400 ${className}`}>
      Seen <span className="font-mono tabular-nums text-white">{seen}</span> of {items.length} {noun}
      {seen === items.length ? " — all of them." : "."}
    </p>
  );
}
