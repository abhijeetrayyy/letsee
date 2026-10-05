"use client";

import { useMemo, useState } from "react";
import MoreFrom from "@components/detail/MoreFrom";
import FansAlsoLove from "@components/detail/FansAlsoLove";
import { Clock } from "lucide-react";
import { releaseInfo } from "@/utils/releaseInfo";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";

import { Section, TitleHero } from "@components/detail/TitleChrome";
import TitleIdentity, { tvIdentity } from "@components/detail/TitleIdentity";
import ProgressRibbon from "@components/detail/ProgressRibbon";
import { SeriesGlance } from "@components/detail/AtAGlance";
import Trailer from "@components/detail/Trailer";
import Availability from "@components/detail/Availability";
import TitleTalk from "@components/takes/TitleTalk";
import TheRoom from "@components/detail/TheRoom";
import WeWatched from "@components/detail/WeWatched";
import SeasonBrowser from "@components/detail/SeasonBrowser";
import CastRow from "@components/detail/CastRow";
import CrewBlock, { groupCrew, keyCrew } from "@components/detail/CrewBlock";
import VideoShelf from "@components/detail/VideoShelf";
import MediaGallery from "@components/detail/MediaGallery";
import TmdbReviews, { prepareReviews } from "@components/detail/TmdbReviews";
import { tvFacts } from "@components/detail/TitleFacts";
import TitleVitals from "@components/detail/TitleVitals";
import Fold from "@components/ds/Fold";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import ShareModal from "@components/social/ShareModal";
import { useMounted } from "@/hooks/useMounted";
import { titlePath } from "@/utils/urls";

/**
 * A series page, which is not a film page with more rows.
 *
 * A film is a thing you did or did not see; a series is a place you are inside
 * of. So this page opens on the one thing a show can tell you that a film
 * cannot — whether more is coming, or how it ended — as the first tile of the
 * glance panel, beside how long the whole thing takes (or how long you have
 * left). Then where you are in it: the ribbon of every episode you have
 * marked, shown once you've started.
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
  runtimes = null,
}: any) {
  const { isAuthenticated } = useMediaInteraction();

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
  const mounted = useMounted();

  const firstAir = releaseInfo(show.first_air_date);
  const premiereAhead = mounted && firstAir.isUpcoming && Boolean(firstAir.full);

  const backdropUrl = show.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}`
    : null;
  const posterUrl = show.poster_path
    ? `https://image.tmdb.org/t/p/w500${show.poster_path}`
    : "/no-photo.svg";

  const crewGroups = groupCrew(credits?.crew);
  const crewKey = keyCrew(credits?.crew, createdBy);

  /**
   * Two rows come out of the fact list, both because something further up says
   * the same thing better. The next-episode date is answered above the fold
   * with a countdown and an episode title beside it; the status is that
   * tile's own headline — "Ended", "Returning" — and the identity line's last
   * segment.
   * A word repeated three screens later under a plainer label reads as a
   * second, worse answer rather than a confirmation.
   */
  /** A series' equivalent of a director credit, beside the synopsis. */
  const creditLines = useMemo(
    () =>
      createdBy.length > 0
        ? [{ label: "Created by", people: createdBy.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })) }]
        : [],
    [createdBy],
  );

  const facts = useMemo(
    () =>
      tvFacts(show, { createdBy, countryNames }).filter(
        (f) =>
          f.key !== "next-episode" &&
          f.key !== "status" &&
          // Named in the hero now; see the movie client for the same reasoning.
          !(creditLines.length > 0 && f.key === "created-by"),
      ),
    [show, createdBy, countryNames, creditLines],
  );

  /**
   * Asked before the layout is chosen rather than after. Only 40% of series
   * carry a TMDB review at all — against 74% of films — so on three pages in
   * five a two-column band would strand the Details card in a right-hand third
   * beside an empty column.
   */
  const hasReviews = useMemo(() => prepareReviews(reviews, REVIEW_MAX).length > 0, [reviews]);

  return (
    <div className="bg-page">
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

      <TitleHero
        compactOnPhone
        backdropUrl={backdropUrl}
        posterUrl={posterUrl}
        title={show.name}
        aside={trailer ? <Trailer videoKey={trailer.key} title={show.name} /> : null}
      >
        <TitleIdentity
          kind="tv"
          view={tvIdentity(show, contentRatings)}
          onShare={() => setShareModalOpen(true)}
          creditLines={creditLines}
          onAddWatchedTv={(intended) => {
            setPendingStatus(intended);
            setMarkWatchedOpen(true);
          }}
          series={{
            seasons: seasons.map((x: { season_number: number; episode_count: number }) => ({ season_number: x.season_number, episode_count: x.episode_count })),
            lastAired: show.last_episode_to_air
              ? { s: show.last_episode_to_air.season_number, e: show.last_episode_to_air.episode_number }
              : null,
          }}
          notice={
            /* A show that has not started has no next episode and no last one,
               so the card below renders nothing for it. This line is the only
               place the premiere date is stated. */
            premiereAhead ? (
              <div className="mt-3 flex max-w-fit items-start gap-2 rounded-lg border border-accent-strong/20 bg-action/10 px-3 py-2 text-sm text-accent-soft">
                <Clock className="mt-0.5 size-3.5 shrink-0" />
                <span>Premieres {firstAir.full}</span>
              </div>
            ) : null
          }
        />
      </TitleHero>

      <>
        {/*
          The order (docs/design/PAGES.md §5, a series): the short version
          first — what's next or how it ended, is it good, how long it takes —
          then where you are in it, your people, the episodes, where to watch
          and your entry; reference material folds in place.
        */}
        <div className="max-w-app mx-auto px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8 pb-16 space-y-10">
          <SeriesGlance show={show} keywords={keywords} runtimes={runtimes} countryNames={countryNames} />

          {/* Side by side from `lg`: the ribbon is a narrow grid, and alone it
              left most of a full-width card empty. Before you start there is
              no ribbon, the wrapper is empty, and the room takes the row. */}
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-8">
            <div className="min-w-0 empty:hidden lg:flex-[2]">
              <ProgressRibbon
                showId={show.id}
                seasons={seasons}
                isAuthenticated={isAuthenticated}
                lastAired={show.last_episode_to_air ? { s: show.last_episode_to_air.season_number, e: show.last_episode_to_air.episode_number } : null}
              />
            </div>
            <div className="min-w-0 lg:flex-1">
              <TheRoom itemId={show.id} itemType="tv" />
            </div>
          </div>

          <Section title="Episodes">
            <SeasonBrowser
              showId={show.id}
              showName={show.name}
              seasons={seasons}
              isAuthenticated={isAuthenticated}
              lastAired={show.last_episode_to_air ? { s: show.last_episode_to_air.season_number, e: show.last_episode_to_air.episode_number } : null}
            />
          </Section>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <Section title="Where to watch">
              <Availability mediaId={show.id} mediaType="tv" compact />
            </Section>
            <Section title="Your entry">
              <TitleTalk
                itemId={String(show.id)}
                itemType="tv"
                itemName={show.name}
                imageUrl={show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null}
                genres={(show.genres ?? []).map((g: { name: string }) => g.name)}
                isAuthenticated={isAuthenticated}
              />
            </Section>
          </div>

          {cast.length > 0 && (
            <Section title="Cast" subtitle={`${cast.length} regulars`}>
              <CastRow cast={cast} fullCreditsHref={`${titlePath("tv", show.id, show.name)}/cast`} />
            </Section>
          )}

          <WeWatched itemId={String(show.id)} itemType="tv" itemName={show.name} posterPath={show.poster_path ?? null} />

          {/* The creator's other series (and how many you've seen), the lead's
              work, and what people here who love it love — each loads when near. */}
          {createdBy[0] && (
            <MoreFrom
              person={{ id: createdBy[0].id, name: createdBy[0].name, profilePath: (createdBy[0] as { profile_path?: string | null }).profile_path ?? null }}
              role="creator"
              current={{ id: show.id, type: "tv" }}
            />
          )}
          {cast[0] && (
            <MoreFrom person={{ id: cast[0].id, name: cast[0].name, profilePath: cast[0].profile_path ?? null }} role="actor" current={{ id: show.id, type: "tv" }} />
          )}
          <FansAlsoLove itemId={String(show.id)} itemType="tv" itemName={show.name} />

          <div className="space-y-3">
            <Fold title="Details" hint="Genres, network, runtime, languages, keywords">
              <TitleVitals genres={show.genres ?? []} facts={facts} keywords={keywords} mediaType="tv" />
            </Fold>
            {(crewGroups.length > 0 || crewKey.length > 0) && (
              <Fold title="Crew" count={crewGroups.reduce((n, g) => n + g.people.length, 0) || undefined}>
                <CrewBlock groups={crewGroups} keyPeople={crewKey} />
              </Fold>
            )}
            {(videos.length > 0 || backdrops.length > 0 || posters.length > 0) && (
              <Fold title="Trailers, clips and stills" count={videos.length + backdrops.length + posters.length}>
                <div className="space-y-8">
                  <VideoShelf videos={videos} />
                  <MediaGallery backdrops={backdrops} posters={posters} title={show.name} />
                </div>
              </Fold>
            )}
            {hasReviews && (
              <Fold title="Reviews from TMDB" count={reviews.length}>
                <TmdbReviews reviews={reviews} max={REVIEW_MAX} />
              </Fold>
            )}
          </div>
        </div>
      </>
    </div>
  );
}
