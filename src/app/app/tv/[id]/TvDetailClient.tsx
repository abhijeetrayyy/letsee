"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Star, Clock, Globe, Play, Share2, Tv, Users, Tag } from "lucide-react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import EpisodeManagementModal from "@components/tv/EpisodeManagementModal";
import UserRating from "@components/movie/UserRating";
import WatchedReview from "@components/movie/WatchedReview";
import PublicReviews from "@components/movie/PublicReviews";
import FriendsWhoWatched from "@components/detail/FriendsWhoWatched";
import RatingDistribution from "@components/detail/RatingDistribution";
import WatchOptionsViewer from "@components/clientComponent/watchOptionView";
import EpisodeListWithWatched from "@components/tv/EpisodeListWithWatched";
import ShareModal from "@components/social/ShareModal";
import Comments from "@components/social/Comments";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { swrFetcher } from "@/utils/swrFetcher";

const LANG: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", ko: "Korean", hi: "Hindi", zh: "Chinese", it: "Italian",
};

export default function TvDetailClient({ show, credits, trailer, certification, backdrops, posters, keywords, externalIds, seasons, createdBy, watchProviders, watchLink }: any) {
  const { getStatus } = useMediaInteraction();
  const isWatched = getStatus(String(show.id)) === "watched";
  const [showTrailer, setShowTrailer] = useState(false);
  const [markWatchedOpen, setMarkWatchedOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [tvStatus, setTvStatus] = useState<string | null>(null);

  const { data: seasonEpisodesData, isLoading: episodesLoading } = useSWR<{ episodes: any[] }>(
    `/api/tv-season-episodes?showId=${encodeURIComponent(show.id)}&season=${activeSeason}`,
    swrFetcher,
  );
  const activeSeasonEpisodes = seasonEpisodesData?.episodes ?? [];

  // Fetch current TV status
  useEffect(() => {
    if (!isWatched) { setTvStatus(null); return; }
    let cancelled = false;
    fetch(`/api/tv-list-status?showId=${encodeURIComponent(show.id)}`, { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (!cancelled) setTvStatus(d?.status ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [show.id, isWatched]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setTvStatus(newStatus);
    await fetch("/api/user-media-status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: String(show.id),
        itemType: "tv",
        status: newStatus,
        name: show.name,
        imgUrl: show.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : undefined,
      }),
    });
  }, [show.id, show.name, show.poster_path]);

  const backdropUrl = show.backdrop_path ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null;
  const posterUrl = show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : "/no-photo.webp";
  const voteAvg = show.vote_average?.toFixed(1);
  const genres = show.genres ?? [];
  const networks = show.networks ?? [];
  const firstAir = show.first_air_date;
  const lastAir = show.last_air_date;
  const numSeasons = show.number_of_seasons;
  const numEpisodes = show.number_of_episodes;
  const nextEpisode = show.next_episode_to_air;
  const activeSeasonData = seasons.find((s: any) => s.season_number === activeSeason);

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
          onClose={() => setMarkWatchedOpen(false)}
          onSuccess={() => setMarkWatchedOpen(false)}
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
          <div className="absolute inset-0 h-[500px] overflow-hidden">
            <img src={backdropUrl} alt="" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-surface-950/10 via-surface-950/80 to-surface-950" />
          </div>
        )}

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 mb-8 transition-colors">
            ← Back
          </Link>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="shrink-0 w-48 sm:w-56 mx-auto md:mx-0">
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
                  </span>
                )}
                {firstAir && <MetaChip label={firstAir?.slice(0, 4)} />}
                {lastAir && lastAir !== firstAir && <MetaChip label={`– ${lastAir?.slice(0, 4)}`} />}
                {numSeasons && <MetaChip label={`${numSeasons} season${numSeasons !== 1 ? "s" : ""}`} />}
                {numEpisodes && <MetaChip label={`${numEpisodes} episodes`} />}
                {show.status && <MetaChip label={show.status} />}
                {certification && <MetaChip label={certification} />}
              </div>

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
                  <Link key={g.id} href={`/app/tvbygenre/list/${g.id}`} className="px-2.5 py-1 rounded-lg bg-surface-800/60 text-xs text-surface-300 hover:text-white hover:bg-surface-700 transition-colors">
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
                  onAddWatchedTv={() => setMarkWatchedOpen(true)}
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

              {/* TV status selector (shown when watched) */}
              {isWatched && tvStatus && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-surface-500">Status:</span>
                  <select
                    value={tvStatus}
                    onChange={e => handleStatusChange(e.target.value)}
                    className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-surface-200"
                  >
                    <option value="watching">Watching</option>
                    <option value="watched">Watched</option>
                    <option value="on_hold">On Hold</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>
              )}

              {/* Overview */}
              {show.overview && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-2">Overview</h3>
                  <p className="text-sm text-surface-300 leading-relaxed max-w-2xl">{show.overview}</p>
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                {createdBy.length > 0 && <DetailBlock label="Created by" value={createdBy.map((c: any) => c.name).join(", ")} />}
                {networks.length > 0 && <DetailBlock label="Network" value={networks.map((n: any) => n.name).join(", ")} />}
                {show.number_of_seasons && <DetailBlock label="Seasons" value={String(show.number_of_seasons)} />}
                {show.number_of_episodes && <DetailBlock label="Episodes" value={String(show.number_of_episodes)} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
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
                />
              )}
            </Section>

            {/* Your Activity */}
            <Section title="Your Activity" subtitle="Rate and review">
              <div className="space-y-4">
                <UserRating itemId={show.id} itemType="tv" itemName={show.name}
                  imageUrl={show.poster_path ? `https://image.tmdb.org/t/p/w92${show.poster_path}` : undefined}
                  isWatched={isWatched} />
                <WatchedReview itemId={show.id} itemType="tv" isWatched={isWatched} />
              </div>
            </Section>

            {/* Cast */}
            {credits.cast?.length > 0 && (
              <Section title="Cast" subtitle={`${credits.cast.length} actors`}>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {credits.cast.slice(0, 12).map((actor: any) => (
                    <Link key={actor.id} href={`/app/person/${actor.id}`} className="shrink-0 w-20 text-center group">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-800 mb-1.5">
                        {actor.profile_path ? (
                          <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Users className="size-6 text-surface-600" /></div>
                        )}
                      </div>
                      <p className="text-xs text-surface-300 line-clamp-1 group-hover:text-white transition-colors">{actor.name}</p>
                      <p className="text-[10px] text-surface-500 line-clamp-1">{actor.character}</p>
                    </Link>
                  ))}
                </div>
              </Section>
            )}

            {/* Community Reviews */}
            <Section title="Community Reviews">
              <PublicReviews itemId={String(show.id)} itemType="tv" />
            </Section>

            {/* Discussion */}
            <Section title="Discussion">
              <Comments itemId={String(show.id)} itemType="tv" />
            </Section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Where to Watch */}
            <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Where to Watch</h3>
              <WatchOptionsViewer mediaId={show.id} mediaType="tv" />
            </div>

            <FriendsWhoWatched itemId={String(show.id)} itemType="tv" />
            <RatingDistribution itemId={String(show.id)} itemType="tv" />

            {/* Keywords */}
            {keywords.length > 0 && (
              <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Tag className="size-3.5" /> Keywords
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.slice(0, 15).map((k: any) => (
                    <span key={k.id} className="px-2 py-1 rounded-lg bg-surface-800/60 text-[10px] text-surface-400">{k.name}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Networks */}
            {networks.length > 0 && (
              <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Network</h3>
                {networks.map((n: any) => (
                  <div key={n.id} className="flex items-center gap-2">
                    {n.logo_path && <img src={`https://image.tmdb.org/t/p/w92${n.logo_path}`} alt={n.name} className="h-5 object-contain" />}
                    <span className="text-sm text-surface-300">{n.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Gallery */}
        {backdrops.length > 0 && (
          <Section title="Gallery" subtitle={`${backdrops.length} backdrops`}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {backdrops.slice(0, 8).map((img: any, i: number) => (
                <div key={i} className="shrink-0 w-64 aspect-video rounded-xl overflow-hidden bg-surface-800">
                  <img src={`https://image.tmdb.org/t/p/w780${img.file_path}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
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

function DetailBlock({ label, value }: { label: string; value: string }) {
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
