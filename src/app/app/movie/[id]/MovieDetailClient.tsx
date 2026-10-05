"use client";

import { useMemo, useState } from "react";
import MoreFrom from "@components/detail/MoreFrom";
import FansAlsoLove from "@components/detail/FansAlsoLove";
import { Calendar } from "lucide-react";
import { releaseInfo } from "@/utils/releaseInfo";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { useCountry } from "@/app/contextAPI/countryContext";

import { Section, TitleHero } from "@components/detail/TitleChrome";
import TitleIdentity, { movieIdentity } from "@components/detail/TitleIdentity";
import Availability from "@components/detail/Availability";
import TitleTalk from "@components/takes/TitleTalk";
import TheRoom from "@components/detail/TheRoom";
import WeWatched from "@components/detail/WeWatched";
import FranchiseStrip from "@components/detail/FranchiseStrip";
import { FilmGlance } from "@components/detail/AtAGlance";
import Trailer from "@components/detail/Trailer";
import ReleaseTimeline, { buildRows } from "@components/detail/ReleaseTimeline";
import CastRow from "@components/detail/CastRow";
import CrewBlock, { groupCrew, keyCrew } from "@components/detail/CrewBlock";
import VideoShelf from "@components/detail/VideoShelf";
import MediaGallery from "@components/detail/MediaGallery";
import TmdbReviews, { prepareReviews } from "@components/detail/TmdbReviews";
import { movieFacts } from "@components/detail/TitleFacts";
import TitleVitals from "@components/detail/TitleVitals";
import Fold from "@components/ds/Fold";
import LazyFold from "@components/ds/LazyFold";
import ShareModal from "@components/social/ShareModal";
import { useMounted } from "@/hooks/useMounted";
import { titlePath } from "@/utils/urls";

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
    : "/no-photo.svg";

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

  /**
   * "Who made it" belongs beside the synopsis, not two screens below it.
   *
   * TMDB splits screenwriting across three jobs — Screenplay, Writer and Story
   * — and a film usually carries only one or two of them. Merged and
   * de-duplicated by id, because Lana Wachowski is credited twice on The Matrix
   * (Writer and Director) and once more if Story is populated.
   */
  const creditLines = useMemo(() => {
    const crew = credits?.crew ?? [];
    const by = (jobs: string[]) => {
      const seen = new Set<number>();
      return crew
        .filter((c: { id: number; job?: string }) => jobs.includes(c.job ?? ""))
        .filter((c: { id: number }) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
        .map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }));
    };
    const writers = by(["Screenplay", "Writer", "Story"]);

    /**
     * One line when the same people did both, which is not an edge case — the
     * Wachowskis wrote and directed The Matrix, and printing "Directed by Lana
     * Wachowski, Lilly Wachowski · Written by Lana Wachowski, Lilly Wachowski"
     * says one thing twice and reads like a bug.
     */
    const ids = (xs: { id: number }[]) => xs.map((x) => x.id).sort().join(",");
    if (directors.length > 0 && writers.length > 0 && ids(directors) === ids(writers)) {
      return [{ label: "Written and directed by", people: directors }];
    }

    return [
      directors.length > 0 ? { label: "Directed by", people: directors } : null,
      writers.length > 0 ? { label: "Written by", people: writers } : null,
    ].filter(Boolean) as { label: string; people: { id: number; name: string }[] }[];
  }, [credits, directors]);

  const facts = useMemo(() => {
    // Both lists emit `status` on exactly the same condition — anything that is
    // not "Released" — so the row is always a second printing of a word already
    // in the identity line under the title, where it is doing more work.
    /**
     * `director` joins the dropped set whenever the hero is already naming
     * them. Two rows apart, the same two names, one of them under a heading
     * that says DIRECTOR and the other under the word "Directed by" — the
     * second printing teaches nobody anything.
     */
    const dropped = new Set(hasTimeline ? ["released", "status"] : ["status"]);
    if (creditLines.length > 0) dropped.add("director");
    return movieFacts(movie, { directors, countryNames }).filter((f) => !dropped.has(f.key));
  }, [movie, directors, countryNames, hasTimeline, creditLines]);

  /**
   * Asked before the layout is chosen rather than after. Reviews are present
   * on 74% of films, and on the quarter without them a two-column band would
   * leave the Details card stranded in a right-hand third beside nothing.
   */
  const hasReviews = useMemo(() => prepareReviews(reviews, REVIEW_MAX).length > 0, [reviews]);

  return (
    <div className="bg-page">
      <ShareModal
        title={movie.title}
        mediaType="movie"
        itemId={movie.id}
        posterPath={movie.poster_path}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />

      <TitleHero
        compactOnPhone
        backdropUrl={backdropUrl}
        posterUrl={posterUrl}
        title={movie.title}
        aside={trailer ? <Trailer videoKey={trailer.key} title={movie.title} /> : null}
      >
        <TitleIdentity
          kind="movie"
          view={movieIdentity(movie, releaseDates)}
          onShare={() => setShareModalOpen(true)}
          creditLines={creditLines}
          notice={
            showsNotice ? (
              <div className="mt-3 flex max-w-fit items-start gap-2 rounded-lg border border-accent-strong/20 bg-action/10 px-3 py-2 text-sm text-accent-soft">
                <Calendar className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {release.full ? `In cinemas ${release.full}` : "Release date to be announced"}
                  {inProduction && <span className="text-accent-soft/60"> · {movie.status}</span>}
                </span>
              </div>
            ) : null
          }
        />
      </TitleHero>

      <>
        {/*
          The order (docs/design/PAGES.md §5, a film): the short version
          first — is it good, how long, where it comes from — then your
          people, where to watch and your entry, then the cast; the reference
          material folds in place with its counts.
        */}
        <div className="max-w-app mx-auto px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8 pb-16 space-y-10">
          <FilmGlance movie={movie} keywords={keywords} collection={collection} countryNames={countryNames} />

          <TheRoom itemId={movie.id} itemType="movie" />

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <Section title="Where to watch">
              <Availability mediaId={movie.id} mediaType="movie" compact />
            </Section>
            <Section title="Your entry">
              <TitleTalk
                itemId={String(movie.id)}
                itemType="movie"
                itemName={movie.title}
                imageUrl={movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null}
                genres={(movie.genres ?? []).map((g: { name: string }) => g.name)}
                isAuthenticated={isAuthenticated}
              />
            </Section>
          </div>

          {cast.length > 0 && (
            <Section title="Cast" subtitle={`${cast.length} actors`}>
              <CastRow cast={cast} fullCreditsHref={`${titlePath("movie", movie.id, movie.title)}/cast`} />
            </Section>
          )}

          <WeWatched itemId={String(movie.id)} itemType="movie" itemName={movie.title} posterPath={movie.poster_path ?? null} />

          {/* Where to go from here: the director's other films (and how many
              you've seen), the lead's, and what people here who love it love.
              Each waits until it's a screen away; none adds a call to this page. */}
          {directors[0] && (
            <MoreFrom
              person={{ id: directors[0].id, name: directors[0].name, profilePath: (directors[0] as { profile_path?: string | null }).profile_path ?? null }}
              role="director"
              current={{ id: movie.id, type: "movie" }}
            />
          )}
          {cast[0] && (!directors[0] || cast[0].id !== directors[0].id) && (
            <MoreFrom person={{ id: cast[0].id, name: cast[0].name, profilePath: cast[0].profile_path ?? null }} role="actor" current={{ id: movie.id, type: "movie" }} />
          )}
          <FansAlsoLove itemId={String(movie.id)} itemType="movie" itemName={movie.title} />

          <div className="space-y-3">
            {/* Its own fold, and an address: the "Watch order" tile above
                links here. */}
            {collection?.id && (
              <LazyFold id="collection" title={collection.name ?? "The collection"} hint="Every film, in order">
                <FranchiseStrip collection={collection} currentId={movie.id} bare />
              </LazyFold>
            )}
            <Fold title="Details and release dates" hint="Studios, languages, money, keywords, every release">
              <div className="space-y-8">
                <TitleVitals genres={movie.genres ?? []} facts={facts} keywords={keywords} mediaType="movie" />
                <ReleaseTimeline releaseDates={releaseDates} />
              </div>
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
                  <MediaGallery backdrops={backdrops} posters={posters} title={movie.title} />
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
