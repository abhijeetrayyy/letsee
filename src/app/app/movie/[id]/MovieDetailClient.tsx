"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { releaseInfo } from "@/utils/releaseInfo";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { useCountry } from "@/app/contextAPI/countryContext";

import { Section, TitleHero } from "@components/detail/TitleChrome";
import TitleIdentity, { movieIdentity } from "@components/detail/TitleIdentity";
import Availability from "@components/detail/Availability";
import TitleTalk from "@components/takes/TitleTalk";
import TheRoom from "@components/detail/TheRoom";
import FranchiseStrip from "@components/detail/FranchiseStrip";
import ReleaseTimeline, { buildRows } from "@components/detail/ReleaseTimeline";
import CastRow from "@components/detail/CastRow";
import CrewBlock, { groupCrew, keyCrew } from "@components/detail/CrewBlock";
import VideoShelf from "@components/detail/VideoShelf";
import MediaGallery from "@components/detail/MediaGallery";
import TmdbReviews, { prepareReviews } from "@components/detail/TmdbReviews";
import { movieFacts } from "@components/detail/TitleFacts";
import TitleVitals from "@components/detail/TitleVitals";
import ShareModal from "@components/social/ShareModal";
import { useMounted } from "@/hooks/useMounted";

/**
 * A film page, ordered the way a journal owes it.
 *
 * The page reads in three movements. First what you can do about this film
 * right now — where it plays, what you wrote, who else is here. Then the film
 * itself: its series, its dates, the people in it, its footage. Then TMDB's
 * account of it, last, because a database's opinion of a film is the least
 * interesting thing on a page that knows what you did with it.
 *
 * Almost nothing is computed in this file any more. The chip pile, the two
 * DetailBlock grids, the hand-rolled certificate and language lookups and the
 * private nine-entry LANG map all became components that own their own rules,
 * and each of those rules was measured against live payloads rather than
 * guessed at. What is left here is the order.
 */

/** The busiest title measured carried 16 reviews; twelve is where a section stops being one. */
const REVIEW_MAX = 12;

export default function MovieDetailClient({
  movie,
  directors = [],
  credits,
  trailer,
  videos = [],
  releaseDates = [],
  countryNames = [],
  backdrops = [],
  posters = [],
  keywords = [],
  collection = null,
  reviews = [],
}: any) {
  const { isAuthenticated } = useMediaInteraction();
  const { country } = useCountry();

  const [showTrailer, setShowTrailer] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  /**
   * Whether a film is "out yet" is read from the clock, and the clock is two
   * different machines: the server renders in UTC and the reader's browser
   * does not. For roughly five hours a day those two disagree about what today
   * is, which for a film releasing on exactly that day means React hydrates a
   * text node it did not render. TMDB's production status is a fact about the
   * film and is safe on the server; the date comparison waits for mount.
   */
  const mounted = useMounted();

  const release = releaseInfo(movie.release_date);
  const inProduction = Boolean(movie.status && movie.status !== "Released");
  const showsNotice = inProduction || (mounted && release.isUpcoming);

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "/no-photo.webp";

  const crewGroups = groupCrew(credits?.crew);
  const crewKey = keyCrew(credits?.crew);
  const cast = credits?.cast ?? [];

  /**
   * The release rail and the Details row would otherwise both answer "when did
   * this come out", and the rail answers it better — region-first, labelled
   * when it borrows another country's date, sorted so it actually reads as a
   * timeline. Where the rail has something to say, the one-line fact stands
   * down. Where it has nothing (a film with no dates on file at all), the fact
   * is the only record left and stays.
   */
  const hasTimeline = useMemo(
    () => buildRows(releaseDates ?? [], country).length > 0,
    [releaseDates, country],
  );

  const facts = useMemo(() => {
    // Both lists emit `status` on exactly the same condition — anything that is
    // not "Released" — so the row is always a second printing of a word already
    // in the identity line under the title, where it is doing more work.
    const dropped = new Set(hasTimeline ? ["released", "status"] : ["status"]);
    return movieFacts(movie, { directors, countryNames }).filter((f) => !dropped.has(f.key));
  }, [movie, directors, countryNames, hasTimeline]);

  /**
   * Asked before the layout is chosen rather than after. Reviews are present
   * on 74% of films, and on the quarter without them a two-column band would
   * leave the Details card stranded in a right-hand third beside nothing.
   */
  const hasReviews = useMemo(() => prepareReviews(reviews, REVIEW_MAX).length > 0, [reviews]);

  return (
    <div className="bg-surface-950">
      {showTrailer && trailer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setShowTrailer(false)}
        >
          <div className="relative w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      <ShareModal
        title={movie.title}
        mediaType="movie"
        itemId={movie.id}
        posterPath={movie.poster_path}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

      <TitleHero backdropUrl={backdropUrl} posterUrl={posterUrl} title={movie.title}>
        <TitleIdentity
          kind="movie"
          view={movieIdentity(movie, releaseDates)}
          hasTrailer={!!trailer}
          onPlayTrailer={() => setShowTrailer(true)}
          onShare={() => setShareModalOpen(true)}
          notice={
            showsNotice ? (
              <div className="mt-3 flex max-w-fit items-start gap-2 rounded-lg border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
                <Calendar className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {release.full ? `In cinemas ${release.full}` : "Release date to be announced"}
                  {inProduction && <span className="text-brand-300/60"> · {movie.status}</span>}
                </span>
              </div>
            ) : null
          }
        />
      </TitleHero>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        {/* Movement one: what this is.
            First, because this is when a reader is forming their assumption —
            what kind of film it is, who directed it, what it cost and what it
            made. The band replaces a Details card that printed one column of
            short values across the full page width, and it carries the genres
            and keywords that were scattered elsewhere. */}
        <TitleVitals
          genres={movie.genres ?? []}
          facts={facts}
          keywords={keywords}
          mediaType="movie"
        />

        {/* Movement two: the film itself. Both of these render their own
            Section and return null when they have nothing, so a standalone
            film with no dates on file adds no empty headings. */}
        <FranchiseStrip collection={collection} currentId={movie.id} />

        <ReleaseTimeline releaseDates={releaseDates} />

        {cast.length > 0 && (
          <Section title="Cast" subtitle={`${cast.length} actors`}>
            <CastRow cast={cast} />
          </Section>
        )}

        {/* Grouped and capped: the full crew is ninety names, and that wall
            already exists on /cast for anyone who wants it. */}
        {(crewGroups.length > 0 || crewKey.length > 0) && (
          <Section title="Crew">
            <CrewBlock groups={crewGroups} keyPeople={crewKey} />
          </Section>
        )}

        {(videos.length > 0 || backdrops.length > 0 || posters.length > 0) && (
          <Section title="Media" subtitle="Trailers, clips and stills">
            <div className="space-y-8">
              {/* Video first: a trailer answers "what is this" faster than a
                  still does, and TMDB sends dozens the page used to discard. */}
              <VideoShelf videos={videos} />
              <MediaGallery backdrops={backdrops} posters={posters} title={movie.title} />
            </div>
          </Section>
        )}

        {/* Movement three: what it is to you, and to everyone else.
            Watching, writing and reading what others wrote are one act of
            attention, so they sit together rather than being split across the
            page — your entry and the room beside the strangers on TMDB who
            reviewed the same film. */}
        <Section title="Where to watch">
          <Availability mediaId={movie.id} mediaType="movie" />
        </Section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            {/* One composer on this page and only one. It used to be two —
                "Your take" here and "Discussion" below — which made the reader
                choose which box a thought belonged in before they had finished
                having it. */}
            <Section title="Your entry">
              <TitleTalk
                itemId={String(movie.id)}
                itemType="movie"
                itemName={movie.title}
                imageUrl={
                  movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null
                }
                genres={(movie.genres ?? []).map((g: { name: string }) => g.name)}
                isAuthenticated={isAuthenticated}
              />
            </Section>

            {hasReviews && <TmdbReviews reviews={reviews} max={REVIEW_MAX} />}
          </div>

          {/* Keywords used to be the second card here. Six thousand pixels
              down a page is not where you put your finest-grained set of
              internal links — they moved up into the hero rail. */}
          <div className="space-y-6">
            <TheRoom itemId={movie.id} itemType="movie" />
          </div>
        </div>

      </div>
    </div>
  );
}
