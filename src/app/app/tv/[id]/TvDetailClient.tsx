"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { releaseInfo } from "@/utils/releaseInfo";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";

import { Section, TitleHero } from "@components/detail/TitleChrome";
import TitleIdentity, { tvIdentity } from "@components/detail/TitleIdentity";
import ProgressRibbon from "@components/detail/ProgressRibbon";
import NextEpisode from "@components/detail/NextEpisode";
import Availability from "@components/detail/Availability";
import TitleTalk from "@components/takes/TitleTalk";
import TheRoom from "@components/detail/TheRoom";
import SeasonBrowser from "@components/detail/SeasonBrowser";
import CastRow from "@components/detail/CastRow";
import CrewBlock, { groupCrew, keyCrew } from "@components/detail/CrewBlock";
import VideoShelf from "@components/detail/VideoShelf";
import MediaGallery from "@components/detail/MediaGallery";
import TmdbReviews, { prepareReviews } from "@components/detail/TmdbReviews";
import TitleFacts, { tvFacts } from "@components/detail/TitleFacts";
import KeywordChips from "@components/detail/KeywordChips";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import ShareModal from "@components/social/ShareModal";

/**
 * A series page, which is not a film page with more rows.
 *
 * A film is a thing you did or did not see; a series is a place you are inside
 * of. So this page opens on where you are in it — the ribbon of every episode
 * you have marked, and the one thing a show can tell you that a film cannot,
 * which is whether more is coming. Both sit above the synopsis, above the cast,
 * above anything a database could say about the show, because they are the
 * only two facts on the page that are about the reader.
 *
 * The season browser that follows replaces a row of tabs and a bare episode
 * list. It opens on the season you are actually in rather than season one of a
 * show you are eleven seasons into, and it shares its watched-episode cache
 * with the ribbon above — marking an episode down here fills a square up there
 * with nothing wired between them.
 */

/** The busiest title measured carried 16 reviews; twelve is where a section stops being one. */
const REVIEW_MAX = 12;

export default function TvDetailClient({
  show,
  credits,
  cast = [],
  trailer,
  videos = [],
  contentRatings = [],
  backdrops = [],
  posters = [],
  keywords = [],
  seasons = [],
  createdBy = [],
  countryNames = [],
  reviews = [],
}: any) {
  const { isAuthenticated } = useMediaInteraction();

  const [showTrailer, setShowTrailer] = useState(false);
  const [markWatchedOpen, setMarkWatchedOpen] = useState(false);
  /** Status the reader picked from the menu; the modal applies it on save. */
  const [pendingStatus, setPendingStatus] = useState<MediaStatus | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  /**
   * Whether a show has premiered yet is read from the clock, and the clock is
   * two different machines — the server renders in UTC and the reader's browser
   * does not. For a show premiering on exactly the day those two disagree
   * about, React would hydrate a text node it never rendered. The comparison
   * waits for mount; the date itself is a fact about the show and is safe
   * either side.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const firstAir = releaseInfo(show.first_air_date);
  const premiereAhead = mounted && firstAir.isUpcoming && Boolean(firstAir.full);

  const backdropUrl = show.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}`
    : null;
  const posterUrl = show.poster_path
    ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
    : "/no-photo.webp";

  const crewGroups = groupCrew(credits?.crew);
  const crewKey = keyCrew(credits?.crew, createdBy);

  /**
   * Two rows come out of the fact list, both because something further up says
   * the same thing better. The next-episode date is answered above the fold
   * with a countdown and an episode title beside it; the status is the card's
   * own headline — "Ended", "Returning" — and the identity line's last segment.
   * A word repeated three screens later under a plainer label reads as a
   * second, worse answer rather than a confirmation.
   */
  const facts = useMemo(
    () =>
      tvFacts(show, { createdBy, countryNames }).filter(
        (f) => f.key !== "next-episode" && f.key !== "status",
      ),
    [show, createdBy, countryNames],
  );

  /**
   * Asked before the layout is chosen rather than after. Only 40% of series
   * carry a TMDB review at all — against 74% of films — so on three pages in
   * five a two-column band would strand the Details card in a right-hand third
   * beside an empty column.
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

      {markWatchedOpen && (
        <EpisodeManagementModal
          showId={String(show.id)}
          showName={show.name}
          isOpen={markWatchedOpen}
          intendedStatus={pendingStatus}
          onClose={() => {
            setMarkWatchedOpen(false);
            setPendingStatus(null);
          }}
          onSuccess={() => {
            setMarkWatchedOpen(false);
            setPendingStatus(null);
          }}
        />
      )}

      <ShareModal
        title={show.name}
        mediaType="tv"
        itemId={show.id}
        posterPath={show.poster_path}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

      <TitleHero backdropUrl={backdropUrl} posterUrl={posterUrl} title={show.name}>
        <TitleIdentity
          kind="tv"
          view={tvIdentity(show, contentRatings)}
          hasTrailer={!!trailer}
          onPlayTrailer={() => setShowTrailer(true)}
          onShare={() => setShareModalOpen(true)}
          onAddWatchedTv={(intended) => {
            setPendingStatus(intended);
            setMarkWatchedOpen(true);
          }}
          notice={
            /* A show that has not started has no next episode and no last one,
               so the card below renders nothing for it. This line is the only
               place the premiere date is stated. */
            premiereAhead ? (
              <div className="mt-3 flex max-w-fit items-start gap-2 rounded-lg border border-brand-500/20 bg-brand-500/10 px-3 py-2 text-sm text-brand-300">
                <Clock className="mt-0.5 size-3.5 shrink-0" />
                <span>Premieres {firstAir.full}</span>
              </div>
            ) : null
          }
        />
      </TitleHero>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-12">
        {/* Where you are, and whether there is more coming. These two are the
            page's whole reason for existing on a journal, so they run before
            anything a database knows. Side by side on a wide screen, stacked on
            a phone with the ribbon first — your own history outranks the
            schedule. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Section title="Your progress">
              <ProgressRibbon showId={show.id} seasons={seasons} isAuthenticated={isAuthenticated} />
            </Section>
          </div>
          <div>
            <NextEpisode
              showId={show.id}
              nextEpisode={show.next_episode_to_air}
              lastEpisode={show.last_episode_to_air}
              status={show.status}
              inProduction={show.in_production}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-10 lg:col-span-2">
            <Section title="Where to watch">
              <Availability mediaId={show.id} mediaType="tv" />
            </Section>

            {/* One composer on this page and only one, at series scope. The
                season and episode pages carry their own; a thought about the
                whole show belongs here. */}
            <Section title="Your entry">
              <TitleTalk
                itemId={String(show.id)}
                itemType="tv"
                scope="title"
                itemName={show.name}
                imageUrl={
                  show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null
                }
                genres={(show.genres ?? []).map((g: { name: string }) => g.name)}
                isAuthenticated={isAuthenticated}
              />
            </Section>
          </div>

          <div>
            <TheRoom itemId={show.id} itemType="tv" />
          </div>
        </div>

        {/* Full width, and deliberately far larger than a film's equivalent —
            this is the part of a series you come back to. */}
        {seasons.length > 0 && (
          <Section title="Episodes">
            <SeasonBrowser showId={show.id} seasons={seasons} isAuthenticated={isAuthenticated} />
          </Section>
        )}

        {cast.length > 0 && (
          <Section title="Cast" subtitle={`${cast.length} regulars`}>
            <CastRow cast={cast} />
          </Section>
        )}

        {/* Crew now arrives ranked out of aggregate_credits, but a handful of
            shows still have none TMDB will admit to. groupCrew returns [] and
            this does not render, rather than leaving a heading over nothing. */}
        {(crewGroups.length > 0 || crewKey.length > 0) && (
          <Section title="Crew">
            <CrewBlock groups={crewGroups} keyPeople={crewKey} />
          </Section>
        )}

        {(videos.length > 0 || backdrops.length > 0 || posters.length > 0) && (
          <Section title="Media" subtitle="Trailers, clips and stills">
            <div className="space-y-8">
              <VideoShelf videos={videos} />
              <MediaGallery backdrops={backdrops} posters={posters} title={show.name} />
            </div>
          </Section>
        )}

        {/* The record, last. Strangers on another site, the production facts,
            and the tags TMDB filed the show under. */}
        {hasReviews ? (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TmdbReviews reviews={reviews} max={REVIEW_MAX} />
            </div>
            <div className="space-y-6">
              <TitleFacts facts={facts} />
              <KeywordChips keywords={keywords} mediaType="tv" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TitleFacts facts={facts} />
            <KeywordChips keywords={keywords} mediaType="tv" />
          </div>
        )}
      </div>
    </div>
  );
}
