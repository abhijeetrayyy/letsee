import Link from "next/link";
import { Info, Shapes } from "lucide-react";
import { buildBrowseUrl } from "@/utils/browseUrl";
import TitleFacts, { type Fact } from "./TitleFacts";
import KeywordChips from "./KeywordChips";

/**
 * The column the hero never had.
 *
 * Measured at 1440px, the hero was a 256px poster, a text column capped at
 * `max-w-2xl`, and then 392px of nothing — 28% of the page width, running the
 * full 760px height of the banner. The cap is not the bug: 1064px lines are
 * unreadable and the measure is right. The bug is that nothing was standing in
 * the space the cap leaves over.
 *
 * So the facts move into it. They were previously a standalone "Details" band
 * directly below the hero, rendered as a single-column `<dl>` stretched across
 * 1336px — a 128px label, a value like "2h 16m", and roughly a thousand pixels
 * of empty row after it, six times over. Reading that list in the leftover
 * column instead costs the page no width at all, and puts the director and the
 * studio beside the title they belong to rather than below the fold.
 *
 * Keywords come with them, from the very bottom of the page. They were the last
 * card in a sidebar under the TMDB reviews, six thousand pixels down — which is
 * no place for the finest-grained set of internal links on the page.
 *
 * One panel, not three cards. Three bordered boxes stacked in a 304px column
 * read as a pile of boxes and spend 40px on chrome between them; one panel with
 * hairlines between its sections says the same thing in less.
 *
 * Below `xl` there is no leftover column to fill, so the rail stops being a
 * rail — it goes full width and the facts inside it reflow into two or three
 * columns. That is a layout change, not a second copy: one node, moved by CSS,
 * so nothing here is rendered twice into the HTML.
 */
export default function TitleVitals({
  genres = [],
  facts,
  keywords = [],
  mediaType,
}: {
  genres?: { id: number; name: string }[];
  facts: Fact[];
  keywords?: { id: number; name: string }[];
  mediaType: "movie" | "tv";
}) {
  if (genres.length === 0 && facts.length === 0 && keywords.length === 0) return null;

  return (
    <div className="divide-y divide-surface-800/50 overflow-hidden rounded-xl border border-surface-800/50 bg-surface-900/30">
      {genres.length > 0 && (
        /**
         * Every genre, where the line under the title shows three.
         *
         * That cap is right where it is — three is the whole width of a
         * sentence that also carries the year, the runtime and the certificate
         * — but it means TMDB's fourth and fifth genres were fetched and then
         * dropped on the floor. Here there is room for all of them, and each
         * one is a door.
         */
        <section className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
            <Shapes className="size-3.5" /> Genres
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Link
                key={g.id}
                href={buildBrowseUrl({ type: mediaType, genre: String(g.id) })}
                /* Tinted, where keywords below are neutral. Genre is the coarse
                   taxonomy and the one people actually navigate by, so it takes
                   the page's accent and the finer one stays quiet. The values
                   match the release notice in the hero beside it. */
                className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs text-brand-300 transition-colors hover:bg-brand-500/20 hover:text-brand-200"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {facts.length > 0 && (
        <section className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
            <Info className="size-3.5" /> Details
          </h3>
          <TitleFacts facts={facts} variant="rail" />
        </section>
      )}

      {keywords.length > 0 && (
        <section className="p-4">
          <KeywordChips keywords={keywords} mediaType={mediaType} bare />
        </section>
      )}
    </div>
  );
}
