"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Clock, Globe, Play, Share2, BookOpen, Film, Users, Tag, ImageIcon, Calendar } from "lucide-react";
import { releaseInfo } from "@/utils/releaseInfo";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import TitleTalk from "@components/takes/TitleTalk";
import CrewBlock, { groupCrew, keyCrew } from "@components/detail/CrewBlock";
import { MetaChip, DetailBlock, Section, TitleHero } from "@components/detail/TitleChrome";
import KeywordChips from "@components/detail/KeywordChips";
import EntityLinks from "@components/detail/EntityLinks";
import { buildBrowseUrl } from "@/utils/browseUrl";
import FriendsWhoWatched from "@components/detail/FriendsWhoWatched";
import TitleAudience from "@components/detail/TitleAudience";
import CastRow from "@components/detail/CastRow";
import MediaGallery from "@components/detail/MediaGallery";
import VideoShelf from "@components/detail/VideoShelf";
import RatingDistribution from "@components/detail/RatingDistribution";
import WatchOptionsViewer from "@components/clientComponent/watchOptionView";
import ShareModal from "@components/social/ShareModal";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { useCountry } from "@/app/contextAPI/countryContext";
import { movieCertification } from "@/utils/title/certification";

const LANG: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", ko: "Korean", hi: "Hindi", zh: "Chinese", it: "Italian",
};

export default function MovieDetailClient({ movie, directors, credits, trailer, videos = [], releaseDates = [], countryNames, backdrops, posters, keywords, collection }: any) {
  const { getStatus, isAuthenticated } = useMediaInteraction();
  // Computed here, not on the server: the route stays static and the chip
  // follows the country selector without a round trip.
  const { country } = useCountry();
  const cert = movieCertification(releaseDates, country);
  const isWatched = getStatus(String(movie.id), "movie") === "watched";
  const [showTrailer, setShowTrailer] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "/no-photo.webp";
  const voteAvg = movie.vote_count > 0 ? movie.vote_average?.toFixed(1) : null;
  const year = releaseInfo(movie.release_date).year;
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;
  const genres = movie.genres ?? [];
  const productionCompanies = movie.production_companies?.slice(0, 3) ?? [];
  const crewGroups = groupCrew(credits.crew);
  const crewKey = keyCrew(credits.crew);
  const budget = movie.budget > 0 ? `$${(movie.budget / 1_000_000).toFixed(0)}M` : null;
  const revenue = movie.revenue > 0 ? `$${(movie.revenue / 1_000_000).toFixed(0)}M` : null;

  // The page showed a bare year, so a film out next December looked exactly
  // like one from 2010. TMDB carries both the exact date and a production
  // status, and together they answer "can I watch this yet?".
  const release = releaseInfo(movie.release_date);
  const isUpcoming = release.isUpcoming || (movie.status && movie.status !== "Released");
  const fullReleaseDate = release.full;
  const originalTitle =
    movie.original_title && movie.original_title !== movie.title ? movie.original_title : null;
  const spokenLanguage =
    LANG[movie.original_language] ?? movie.spoken_languages?.[0]?.english_name ?? null;

  return (
    <div className="bg-surface-950">
      {/* Trailer modal */}
      {showTrailer && trailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setShowTrailer(false)}>
          <div className="relative w-full max-w-4xl mx-4" onClick={e => e.stopPropagation()}>
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen />
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
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{movie.title}</h1>
              {movie.tagline && (
                <p className="mt-2 text-lg text-surface-400 italic">&ldquo;{movie.tagline}&rdquo;</p>
              )}

              {/* Metadata chips */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {voteAvg && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-semibold">
                    <Star className="size-3.5 fill-current" /> {voteAvg}
                    {movie.vote_count > 0 && (
                      <span className="text-amber-400/60 font-normal text-xs">
                        ({movie.vote_count.toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
                {year && <MetaChip label={String(year)} />}
                {runtime && <MetaChip icon={<Clock className="size-3" />} label={runtime} />}
                {cert && (
                  /* The country travels with a borrowed rating. A US rating
                     shown unlabelled to an Indian reader is a confident lie;
                     labelled, it is a useful approximation. */
                  <MetaChip label={cert.isLocal ? cert.value : `${cert.value} · ${cert.country}`} />
                )}
                {countryNames.length > 0 && <MetaChip icon={<Globe className="size-3" />} label={countryNames[0]} />}
              </div>

              {/* Not out yet — say so plainly and give the date. */}
              {isUpcoming && (
                <div className="mt-3 flex max-w-fit items-start gap-2 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-sm text-brand-300">
                  <Calendar className="size-3.5 mt-0.5 shrink-0" />
                  <span>
                    {fullReleaseDate ? `In cinemas ${fullReleaseDate}` : "Release date to be announced"}
                    {movie.status && movie.status !== "Released" && (
                      <span className="text-brand-300/60"> · {movie.status}</span>
                    )}
                  </span>
                </div>
              )}

              {/* Genres */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {genres.map((g: any) => (
                  <Link key={g.id} href={buildBrowseUrl({ genre: String(g.id) })} className="px-2.5 py-1 rounded-lg bg-surface-800/60 text-xs text-surface-300 hover:text-white hover:bg-surface-700 transition-colors">
                    {g.name}
                  </Link>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-5">
                <ThreePrefrenceBtn
                  variant="detail"
                  cardId={movie.id}
                  cardType="movie"
                  cardName={movie.title}
                  cardAdult={movie.adult}
                  cardImg={movie.poster_path}
                  genres={genres.map((g: any) => g.name)}
                />
                {trailer && (
                  <button onClick={() => setShowTrailer(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border border-brand-500/20 text-sm font-medium transition-colors">
                    <Play className="size-4 fill-current" /> Trailer
                  </button>
                )}
                <button onClick={() => setShareModalOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-800/60 text-surface-300 hover:text-white border border-surface-700/50 text-sm font-medium transition-colors">
                  <Share2 className="size-4" /> Share
                </button>
              </div>

              {/* Overview */}
              {movie.overview && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-2">Overview</h3>
                  <p className="text-sm text-surface-300 leading-relaxed max-w-2xl">{movie.overview}</p>
                </div>
              )}

              {/* Details row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {directors.length > 0 && (
                  <DetailBlock
                    label="Director"
                    value={<EntityLinks items={directors} href={(d) => `/app/person/${d.id}`} />}
                  />
                )}
                {productionCompanies.length > 0 && (
                  <DetailBlock
                    label="Studio"
                    value={
                      <EntityLinks
                        items={productionCompanies}
                        href={(c) => buildBrowseUrl({ type: "movie", company: String(c.id) })}
                      />
                    }
                  />
                )}
                {budget && <DetailBlock label="Budget" value={budget} />}
                {revenue && <DetailBlock label="Revenue" value={revenue} />}
                {fullReleaseDate && !isUpcoming && (
                  <DetailBlock label="Released" value={fullReleaseDate} />
                )}
                {movie.status && !isUpcoming && <DetailBlock label="Status" value={movie.status} />}
                {spokenLanguage && <DetailBlock label="Language" value={spokenLanguage} />}
                {/* Foreign titles are often better known by their original
                    name, which matters a lot for this app's catalogue. */}
                {originalTitle && <DetailBlock label="Original title" value={originalTitle} />}
                {countryNames.length > 0 && (
                  <DetailBlock label="Country" value={countryNames.join(", ")} />
                )}
              </div>
      </TitleHero>

      {/* Content below hero.
          `space-y-10` matters here: the Gallery section is a sibling of the
          two-column grid, not a child of it, and the wrapper carried no
          vertical spacing at all. So Gallery started the pixel the grid
          ended — and because the grid's columns are different heights, its
          heading collided with whichever column ran longest (Crew, usually).
          Same gap as the main column already uses between its own sections. */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Where to Watch */}
            <Section title="Where to Watch" subtitle="Streaming options">
              <WatchOptionsViewer mediaId={movie.id} mediaType="movie" />
            </Section>

            {/* One composer, one thread.
                The page used to carry "Your take" here and "Discussion"
                further down, which made the reader choose which box a thought
                belonged in before they had finished having it. Now there is
                one place to type: what you write is yours until you post it,
                and posting it makes it the first thing you said in the thread. */}
            <Section title="Talk about it">
              <TitleTalk
                itemId={String(movie.id)}
                itemType="movie"
                itemName={movie.title}
                imageUrl={movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null}
                genres={(movie.genres ?? []).map((g: { name: string }) => g.name)}
                isAuthenticated={isAuthenticated}
              />
            </Section>

            {/* Cast */}
            {credits.cast?.length > 0 && (
              <Section title="Cast" subtitle={`${credits.cast.length} actors`}>
                <CastRow cast={credits.cast} />
              </Section>
            )}

            {/* Who made it. Grouped by department and capped, because the
                full crew is ninety names and that wall already exists on the
                /cast route for anyone who wants it. */}
            {(crewGroups.length > 0 || crewKey.length > 0) && (
              <Section title="Crew">
                <CrewBlock groups={crewGroups} keyPeople={crewKey} />
              </Section>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Friends */}
            <TitleAudience itemId={movie.id} itemType="movie" />
            <FriendsWhoWatched itemId={String(movie.id)} itemType="movie" />
            <RatingDistribution itemId={String(movie.id)} itemType="movie" />

            {/* Keywords */}
            <KeywordChips keywords={keywords} mediaType="movie" />

            {/* Collection */}
            {collection && (
              <Link href={buildBrowseUrl({ collection: String(collection.id) })} className="block rounded-xl border border-brand-500/10 bg-brand-500/3 p-4 hover:bg-brand-500/5 transition-colors">
                <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Part of Collection</h3>
                <p className="text-sm text-white font-medium">{collection.name}</p>
              </Link>
            )}
          </div>
        </div>

        {/* Media gallery */}
        {(backdrops.length > 0 || posters.length > 0) && (
          <Section title="Media" subtitle="Trailers, clips and stills">
            <div className="space-y-8">
              {/* Videos first: a trailer answers "what is this" faster than a
                  still does, and TMDB sends dozens the page used to discard. */}
              <VideoShelf videos={videos} />
              <MediaGallery backdrops={backdrops} posters={posters} title={movie.title} />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}



