import Link from "next/link";
import { Tag } from "lucide-react";
import { buildBrowseUrl } from "@/utils/browseUrl";

/**
 * Keywords, as doors rather than decoration.
 *
 * These were already on the page — as inert `<span>`s, sitting in the same
 * sidebar as genre chips that have been links all along. That inconsistency is
 * the whole of D2 in miniature: the data was fetched, rendered, and then led
 * nowhere.
 *
 * `mediaType` is not cosmetic. A keyword followed from a series has to search
 * TV, and the reason the existing keyword search couldn't be reused is that it
 * hardcodes `discover/movie` — so a keyword on *Severance* could only ever
 * return films.
 *
 * Owns its whole card, because the markup was byte-identical in the movie and
 * TV clients and duplicating it a third time is how the two pages drift.
 */
export default function KeywordChips({
  keywords = [],
  mediaType,
  limit = 15,
  /** Drop the card chrome — the hero rail supplies one panel for all three blocks. */
  bare = false,
}: {
  keywords?: { id: number; name: string }[];
  mediaType: "movie" | "tv";
  limit?: number;
  bare?: boolean;
}) {
  if (keywords.length === 0) return null;

  return (
    <div className={bare ? "" : "rounded-xl border border-surface-800/50 bg-surface-900/30 p-4"}>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
        <Tag className="size-3.5" /> Keywords
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {keywords.slice(0, limit).map((k) => (
          <Link
            key={k.id}
            href={buildBrowseUrl({ type: mediaType, keyword: String(k.id) })}
            // Same chip shape as before, plus the hover the genre chips
            // directly above already had.
            className="rounded-lg bg-surface-800/60 px-2 py-1 text-[10px] text-surface-400 transition-colors hover:bg-surface-700 hover:text-white"
          >
            {k.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
