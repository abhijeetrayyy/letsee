import Link from "next/link";
import { Info, Shapes } from "lucide-react";
import { buildBrowseUrl } from "@/utils/browseUrl";
import TitleFacts, { type Fact } from "./TitleFacts";
import KeywordChips from "./KeywordChips";

/**
 * What this title is, in one band directly under the hero.
 *
 * Genres, the production facts and the keywords — three things that were in
 * three places, none of them good. The facts were a single-column <dl>
 * stretched across 1336px: a 128px label, a value like "2h 16m", and roughly a
 * thousand pixels of empty row after it, six rows deep. Keywords were the last
 * card in a sidebar under the TMDB reviews, six thousand pixels down, which is
 * no place for the finest-grained set of internal links on the page. Genres
 * were three of TMDB's five in the line under the title, the other two fetched
 * and dropped.
 *
 * This was first built as a rail inside the hero, filling the 392px that the
 * text column's `max-w-2xl` measure cap leaves empty at 1440px. That was wrong,
 * and wrong in a way worth recording: a vitals column is as tall as TMDB is
 * talkative, and that is always taller than a poster and four lines of
 * synopsis. Measured at 1920px it ran 871px against a left column that ended at
 * 705px, stretched the hero to match, and opened a 1304x488 void in the middle
 * of the page — a far bigger hole than the one it was closing. A tall thin gap
 * traded for a vast one is not a trade.
 *
 * Full width, its height is nobody else's problem, and the facts spend the
 * page's width rather than the hero's — four columns where there is room.
 *
 * One panel with hairlines, not three cards: three bordered boxes read as a
 * pile and spend 40px of chrome on the gaps between them.
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
    <section
      aria-labelledby="title-vitals"
      className="divide-y divide-surface-800/50 overflow-hidden rounded-xl border border-surface-800/50 bg-surface-900/30"
    >
      {/*
        The band's three blocks are `h3`, and every other section on the page is
        `h2` with `h3` beneath it — Media then Trailers. Here there was no `h2`,
        so the document outline ran h1 straight to h3 and someone navigating by
        heading heard "The Matrix" then "Genres" with nothing between to say
        what Genres belonged to.

        Visually hidden rather than shown: the band deliberately has no visible
        title, and inventing one to satisfy an outline would be letting the
        markup design the page. `sr-only` is already how the hero prints the
        title when TMDB has a logo to show instead.
      */}
      <h2 id="title-vitals" className="sr-only">
        About this {mediaType === "tv" ? "series" : "film"}
      </h2>
      {genres.length > 0 && (
        /**
         * Every genre, where the line under the title shows three.
         *
         * That cap is right where it is — three is the whole width of a
         * sentence that also carries the year, the runtime and the certificate
         * — but it means TMDB's fourth and fifth genres were dropped on the
         * floor. Here there is room for all of them, and each one is a door.
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
          <TitleFacts facts={facts} variant="grid" />
        </section>
      )}

      {keywords.length > 0 && (
        <section className="p-4">
          <KeywordChips keywords={keywords} mediaType={mediaType} bare />
        </section>
      )}
    </section>
  );
}
