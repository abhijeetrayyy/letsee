"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Star, Clock, Globe, Play, Share2, Tv, Users, Tag } from "lucide-react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import TitleTalk from "@components/takes/TitleTalk";
import CrewBlock, { groupCrew } from "@components/detail/CrewBlock";
import KeywordChips from "@components/detail/KeywordChips";
import EntityLinks from "@components/detail/EntityLinks";
import { buildBrowseUrl } from "@/utils/browseUrl";
import FriendsWhoWatched from "@components/detail/FriendsWhoWatched";
import TitleAudience from "@components/detail/TitleAudience";
import CastRow from "@components/detail/CastRow";
import MediaGallery from "@components/detail/MediaGallery";
import RatingDistribution from "@components/detail/RatingDistribution";
import WatchOptionsViewer from "@components/clientComponent/watchOptionView";
import EpisodeListWithWatched from "@components/tv/EpisodeListWithWatched";
import ShareModal from "@components/social/ShareModal";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";
import { swrFetcher } from "@/utils/swrFetcher";
import { releaseInfo } from "@/utils/releaseInfo";

const LANG: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", ko: "Korean", hi: "Hindi", zh: "Chinese", it: "Italian",
};

export default function TvDetailClient({ show, credits, trailer, certification, backdrops, posters, keywords, externalIds, seasons, createdBy, watchProviders, watchLink }: any) {
  const { getStatus, isAuthenticated } = useMediaInteraction();
  const isWatched = getStatus(String(show.id), "tv") === "watched";
  const [showTrailer, setShowTrailer] = useState(false);
  const [markWatchedOpen, setMarkWatchedOpen] = useState(false);
  // Status the user picked from the menu; the modal applies it on save.
  const [pendingStatus, setPendingStatus] = useState<MediaStatus | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeSeason, setActiveSeason] = useState<number>(1);

  const { data: seasonEpisodesData, isLoading: episodesLoading } = useSWR<{ episodes: any[] }>(
    `/api/tv-season-episodes?showId=${encodeURIComponent(show.id)}&season=${activeSeason}`,
    swrFetcher,
  );
  const activeSeasonEpisodes = seasonEpisodesData?.episodes ?? [];

  // Status is owned by StatusControl in the action row — this page used to
  // carry a second, separate <select> for it that only appeared once the show
  // was already watched.

  const backdropUrl = show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null;
  const posterUrl = show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : "/no-photo.webp";
  const voteAvg = show.vote_count > 0 ? show.vote_average?.toFixed(1) : null;
  const genres = show.genres ?? [];
  const networks = show.networks ?? [];
  // Present on the payload and referenced nowhere until now, so TV never got
  // the studio door films had.
  const productionCompanies = show.production_companies?.slice(0, 3) ?? [];
  const crewGroups = groupCrew(credits.crew);
  const firstAir = show.first_air_date;
  const lastAir = show.last_air_date;
  const numSeasons = show.number_of_seasons;
  const numEpisodes = show.number_of_episodes;
  const nextEpisode = show.next_episode_to_air;
  const activeSeasonData = seasons.find((s: any) => s.season_number === activeSeason);

  // The chips carried only years. TMDB gives exact dates plus whether the show
  // is still running, which is the thing you actually want to know before
  // starting one.
  const firstAirInfo = releaseInfo(firstAir);
  const firstAirFull = firstAirInfo.full;
  const lastAirFull = releaseInfo(lastAir).full;
  const episodeRuntime = Array.isArray(show.episode_run_time)
    ? show.episode_run_time.find((n: number) => n > 0)
    : null;
  const originalName =
    show.original_name && show.original_name !== show.name ? show.original_name : null;
  // LANG covers the common cases; spoken_languages is the fallback for the rest.
  const spokenLanguage =
    LANG[show.original_language] ?? show.spoken_languages?.[0]?.english_name ?? null;
  const notYetAired = firstAirInfo.isUpcoming;

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

      {/* Episode Management modal */}
      {markWatchedOpen && (
        <EpisodeManagementModal
          showId={String(show.id)}
          showName={show.name}
          isOpen={markWatchedOpen}
          intendedStatus={pendingStatus}
          onClose={() => { setMarkWatchedOpen(false); setPendingStatus(null); }}
          onSuccess={() => { setMarkWatchedOpen(false); setPendingStatus(null); }}
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

      {/* Hero */}
      <div className="relative">
        {backdropUrl && (
          <div className="absolute inset-0 h-[680px] overflow-hidden">
            <img src={backdropUrl} alt="" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-surface-950/10 via-surface-950/80 to-surface-950" />
          </div>
        )}

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 sm:pt-20 sm:pb-20">
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 mb-8 transition-colors">
            ← Back
          </Link>

          <div className="flex flex-col md:flex-row gap-8 md:gap-12">
            {/* Poster */}
            <div className="shrink-0 w-52 sm:w-60 lg:w-64 mx-auto md:mx-0">
              <img src={posterUrl} alt={show.name} className="w-full rounded-2xl shadow-2xl" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{show.name}</h1>
              {show.tagline && (
                <p className="mt-2 text-lg text-surface-400 italic">&ldquo;{show.tagline}&rdquo;</p>
              )}

              {/* Metadata chips */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {voteAvg && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-semibold">
                    <Star className="size-3.5 fill-current" /> {voteAvg}
                    {show.vote_count > 0 && (
                      <span className="text-amber-400/60 font-normal text-xs">
                        ({show.vote_count.toLocaleString()})
                      </span>
                    )}
                  </span>
                )}
                {firstAir && <MetaChip label={firstAir?.slice(0, 4)} />}
                {lastAir && lastAir !== firstAir && <MetaChip label={`– ${lastAir?.slice(0, 4)}`} />}
                {numSeasons && <MetaChip label={`${numSeasons} season${numSeasons !== 1 ? "s" : ""}`} />}
                {numEpisodes && <MetaChip label={`${numEpisodes} episodes`} />}
                {show.status && <MetaChip label={show.status} />}
                {certification && <MetaChip label={certification} />}
              </div>

              {/* Hasn't started yet — the next-episode chip below only covers
                  shows already airing. */}
              {notYetAired && firstAirFull && (
                <div className="mt-3 flex max-w-fit items-start gap-2 px-3 py-2 rounded-lg bg-brand-500/10 border border-brand-500/20 text-sm text-brand-300">
                  <Clock className="size-3.5 mt-0.5 shrink-0" />
                  <span>Premieres {firstAirFull}</span>
                </div>
              )}

              {/* Next episode alert */}
              {nextEpisode && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-sm text-brand-300">
                  <Clock className="size-3.5" />
                  Next: S{nextEpisode.season_number}E{nextEpisode.episode_number} — {nextEpisode.name} ({nextEpisode.air_date ? new Date(nextEpisode.air_date).toLocaleDateString() : "TBA"})
                </div>
              )}

              {/* Genres */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {genres.map((g: any) => (
                  <Link key={g.id} href={buildBrowseUrl({ type: "tv", genre: String(g.id) })} className="px-2.5 py-1 rounded-lg bg-surface-800/60 text-xs text-surface-300 hover:text-white hover:bg-surface-700 transition-colors">
                    {g.name}
                  </Link>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-5">
                <ThreePrefrenceBtn
                  variant="detail"
                  cardId={show.id}
                  cardType="tv"
                  cardName={show.name}
                  cardAdult={show.adult}
                  cardImg={show.poster_path}
                  genres={genres.map((g: any) => g.name)}
                  onAddWatchedTv={(intended) => { setPendingStatus(intended); setMarkWatchedOpen(true); }}
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
              {show.overview && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-2">Overview</h3>
                  <p className="text-sm text-surface-300 leading-relaxed max-w-2xl">{show.overview}</p>
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {createdBy.length > 0 && (
                  <DetailBlock
                    label="Created by"
                    value={<EntityLinks items={createdBy} href={(c) => `/app/person/${c.id}`} />}
                  />
                )}
                {networks.length > 0 && (
                  <DetailBlock
                    label="Network"
                    value={
                      <EntityLinks
                        items={networks}
                        href={(n) => buildBrowseUrl({ type: "tv", network: String(n.id) })}
                      />
                    }
                  />
                )}
                {productionCompanies.length > 0 && (
                  <DetailBlock
                    label="Studio"
                    value={
                      <EntityLinks
                        items={productionCompanies}
                        href={(c) => buildBrowseUrl({ type: "tv", company: String(c.id) })}
                      />
                    }
                  />
                )}
                {show.number_of_seasons && <DetailBlock label="Seasons" value={String(show.number_of_seasons)} />}
                {show.number_of_episodes && <DetailBlock label="Episodes" value={String(show.number_of_episodes)} />}
                {firstAirFull && <DetailBlock label="First aired" value={firstAirFull} />}
                {lastAirFull && lastAir !== firstAir && (
                  <DetailBlock label={show.in_production ? "Latest episode" : "Last aired"} value={lastAirFull} />
                )}
                {show.status && <DetailBlock label="Status" value={show.status} />}
                {episodeRuntime && <DetailBlock label="Episode length" value={`${episodeRuntime} min`} />}
                {show.type && <DetailBlock label="Type" value={show.type} />}
                {spokenLanguage && <DetailBlock label="Language" value={spokenLanguage} />}
                {originalName && <DetailBlock label="Original title" value={originalName} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
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
            {/* Seasons & Episodes */}
            <Section title="Episodes" subtitle={`${seasons.length} season${seasons.length !== 1 ? "s" : ""}`}>
              {/* Season tabs */}
              <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                {seasons.map((s: any) => (
                  <button
                    key={s.season_number}
                    onClick={() => setActiveSeason(s.season_number)}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeSeason === s.season_number ? "bg-brand-500/20 text-brand-400 border border-brand-500/30" : "bg-surface-800/60 text-surface-400 hover:text-surface-200 border border-surface-700/30"}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              {activeSeasonData && (
                <EpisodeListWithWatched
                  showId={String(show.id)}
                  seasonNumber={activeSeason}
                  episodes={activeSeasonEpisodes}
                  episodesLoading={episodesLoading}
                  allSeasons={seasons.map((s: any) => ({ id: s.id, season_number: s.season_number, episode_count: s.episode_count }))}
                  // A detail page is a summary, not an episode browser — long
                  // anime seasons run to four figures. The season page is the
                  // place to go through them all.
                  initialCount={8}
                  seeAllHref={`/app/tv/${show.id}/season/${activeSeason}`}
                />
              )}
            </Section>

            {/* One composer, one thread.
                The page used to carry "Your take" here and "Discussion"
                further down, which made the reader choose which box a thought
                belonged in before they had finished having it. Now there is
                one place to type: what you write is yours until you post it,
                and posting it makes it the first thing you said in the thread. */}
            <Section title="Talk about it">
              <TitleTalk
                itemId={String(show.id)}
                itemType="tv"
                itemName={show.name}
                imageUrl={show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : null}
                genres={(show.genres ?? []).map((g: { name: string }) => g.name)}
                isAuthenticated={isAuthenticated}
              />
            </Section>

            {/* Cast */}
            {credits.cast?.length > 0 && (
              <Section title="Cast" subtitle={`${credits.cast.length} actors`}>
                <CastRow cast={credits.cast} />
              </Section>
            )}

            {/* Series-level crew is often thin — a few executive producers,
                sometimes nothing. groupCrew returns [] and this doesn't
                render, which is why `created_by` above carries the page. */}
            {crewGroups.length > 0 && (
              <Section title="Crew">
                <CrewBlock groups={crewGroups} />
              </Section>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Where to Watch */}
            <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Where to Watch</h3>
              <WatchOptionsViewer mediaId={show.id} mediaType="tv" />
            </div>

            <TitleAudience itemId={show.id} itemType="tv" />

            <FriendsWhoWatched itemId={String(show.id)} itemType="tv" />
            <RatingDistribution itemId={String(show.id)} itemType="tv" />

            {/* Keywords */}
            <KeywordChips keywords={keywords} mediaType="tv" />

            {/* Networks */}
            {networks.length > 0 && (
              <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Network</h3>
                {networks.slice(0, 4).map((n: any) => (
                  <Link
                    key={n.id}
                    href={buildBrowseUrl({ type: "tv", network: String(n.id) })}
                    className="flex items-center gap-2 rounded-lg py-1 transition-colors hover:text-white"
                  >
                    {n.logo_path && <img src={`https://image.tmdb.org/t/p/w92${n.logo_path}`} alt={n.name} className="h-5 object-contain" />}
                    <span className="text-sm text-surface-300">{n.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gallery */}
        {(backdrops.length > 0 || posters.length > 0) && (
          <Section title="Gallery" subtitle="Tap any image to view full size">
            <MediaGallery backdrops={backdrops} posters={posters} title={show.name} />
          </Section>
        )}
      </div>
    </div>
  );
}

function MetaChip({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-800/60 text-xs text-surface-400">
      {icon}{label}
    </span>
  );
}

function DetailBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-surface-300 mt-0.5">{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-brand-500" />
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-surface-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
