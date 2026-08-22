import Link from "next/link";
import { Info, Shapes } from "lucide-react";
import { buildBrowseUrl } from "@/utils/browseUrl";
import TitleFacts, { type Fact } from "./TitleFacts";
import KeywordChips from "./KeywordChips";

/**
 * What this title is, and who is here with you — one band under the hero.
 *
 * ── How it got here ────────────────────────────────────────────────────────
 * Genres, the production facts and the keywords were in three places, none of
 * them good: the facts were a single-column <dl> stretched across 1336px,
 * keywords were the last card in a sidebar six thousand pixels down, and two of
 * TMDB's five genres were fetched and dropped.
 *
 * They were then briefly a rail inside the hero, which was worse. A vitals
 * column is as tall as TMDB is talkative, and that is always taller than a
 * poster and four lines of synopsis: measured at 1920px it ran 871px against a
 * left column ending at 705px and opened a 1304x488 void mid-page. Height that
 * is content-driven must not be asked to line up with height that is not.
 *
 * ── Why two columns now ────────────────────────────────────────────────────
 * As three stacked full-width rows this band spent its width badly. Genres is
 * two chips; at 1336px that row was ~1200px of nothing. Meanwhile "Who's here"
 * sat alone at the bottom of the page in a sidebar, which is the wrong place
 * for the one section that answers "did anyone I know watch this".
 *
 * So: facts on the left, the room on the right. The measurement that makes this
 * safe is that the two are comparable — the facts band ran 412-446px and the
 * room 427px with a person in it. Both are cards in normal flow, so a
 * difference just ends one column early; nothing stretches to match, which is
 * exactly the failure the hero rail had.
 *
 * `items-start` is load-bearing for that reason.
 *
 * The room is passed in rather than imported: it is a client component that
 * fetches per title, and this file stays a presentational shell that both
 * detail pages hand their own pieces to.
 */
export default function TitleVitals({
  genres = [],
  facts,
  keywords = [],
  mediaType,
  room,
}: {
  genres?: { id: number; name: string }[];
  facts: Fact[];
  keywords?: { id: number; name: string }[];
  mediaType: "movie" | "tv";
  /** "Who's here" — rendered in the right column on `lg`, below on a phone. */
  room?: React.ReactNode;
}) {
  const hasFacts = genres.length > 0 || facts.length > 0 || keywords.length > 0;
  if (!hasFacts && !room) return null;

  return (
    <section aria-labelledby="title-vitals" className="grid items-start gap-4 lg:grid-cols-3">
      {/*
        The band's blocks are `h3` and every other section on the page is `h2`
        with `h3` beneath it — Media, then Trailers. Without an `h2` the outline
        ran h1 straight to h3, so navigating by heading gave "The Matrix" then
        "Genres" with nothing to say what Genres belonged to. Hidden rather than
        shown because the band deliberately has no visible title, and inventing
        one to satisfy an outline would let the markup redesign the page.
      */}
      <h2 id="title-vitals" className="sr-only">
        About this {mediaType === "tv" ? "series" : "film"}
      </h2>

      {hasFacts && (
        <div className="divide-y divide-surface-800/50 overflow-hidden rounded-xl border border-surface-800/50 bg-surface-900/30 lg:col-span-2">
          {genres.length > 0 && (
            /**
             * Every genre, where the line under the title shows three. That cap
             * is right there — three is the whole width of a sentence also
             * carrying the year, runtime and certificate — but it left TMDB's
             * fourth and fifth on the floor. Here each one is a door.
             */
            <section className="px-5 py-4">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
                <Shapes className="size-3.5" /> Genres
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <Link
                    key={g.id}
                    href={buildBrowseUrl({ type: mediaType, genre: String(g.id) })}
                    /* Tinted, where keywords below are neutral: genre is the
                       coarse taxonomy people actually navigate by, so it takes
                       the accent and the finer one stays quiet. */
                    className="rounded-lg border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-xs text-brand-300 transition-colors hover:bg-brand-500/20 hover:text-brand-200"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {facts.length > 0 && (
            <section className="px-5 py-4">
              <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-400">
                <Info className="size-3.5" /> Details
              </h3>
              {/* Three columns at this width rather than four: the band is now
                  two thirds of the page, and a 220px cell wraps studio names
                  into towers. */}
              <TitleFacts facts={facts} variant="grid" />
            </section>
          )}

          {keywords.length > 0 && (
            <section className="px-5 py-4">
              <KeywordChips keywords={keywords} mediaType={mediaType} bare />
            </section>
          )}
        </div>
      )}

      {room && <div className="lg:col-span-1">{room}</div>}
    </section>
  );
}
