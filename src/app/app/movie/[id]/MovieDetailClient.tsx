"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Clock, Globe, Play, Share2, BookOpen, Film, Users, Tag, ImageIcon } from "lucide-react";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import UserRating from "@components/movie/UserRating";
import WatchedReview from "@components/movie/WatchedReview";
import PublicReviews from "@components/movie/PublicReviews";
import FriendsWhoWatched from "@components/detail/FriendsWhoWatched";
import RatingDistribution from "@components/detail/RatingDistribution";
import WatchOptionsViewer from "@components/clientComponent/watchOptionView";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";

const LANG: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", ko: "Korean", hi: "Hindi", zh: "Chinese", it: "Italian",
};

export default function MovieDetailClient({ movie, directors, credits, trailer, certification, countryNames, backdrops, posters, keywords, collection, watchProviders, watchLink }: any) {
  const { getStatus } = useMediaInteraction();
  const isWatched = getStatus(String(movie.id)) === "watched";
  const [showTrailer, setShowTrailer] = useState(false);

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : null;
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "/no-photo.webp";
  const voteAvg = movie.vote_average?.toFixed(1);
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;
  const genres = movie.genres ?? [];
  const production = movie.production_companies?.slice(0, 3).map((c: any) => c.name).join(", ") ?? null;
  const budget = movie.budget > 0 ? `$${(movie.budget / 1_000_000).toFixed(0)}M` : null;
  const revenue = movie.revenue > 0 ? `$${(movie.revenue / 1_000_000).toFixed(0)}M` : null;

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

      {/* Hero */}
      <div className="relative">
        {backdropUrl && (
          <div className="absolute inset-0 h-[500px] overflow-hidden">
            <img src={backdropUrl} alt="" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-surface-950/10 via-surface-950/80 to-surface-950" />
          </div>
        )}

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
          {/* Back link */}
          <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 mb-8 transition-colors">
            ← Back
          </Link>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="shrink-0 w-48 sm:w-56 mx-auto md:mx-0">
              <img src={posterUrl} alt={movie.title} className="w-full rounded-2xl shadow-2xl" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{movie.title}</h1>
              {movie.tagline && (
                <p className="mt-2 text-lg text-surface-400 italic">&ldquo;{movie.tagline}&rdquo;</p>
              )}

              {/* Metadata chips */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {voteAvg && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-semibold">
                    <Star className="size-3.5 fill-current" /> {voteAvg}
                  </span>
                )}
                {year && <MetaChip label={String(year)} />}
                {runtime && <MetaChip icon={<Clock className="size-3" />} label={runtime} />}
                {certification && <MetaChip label={certification} />}
                {countryNames.length > 0 && <MetaChip icon={<Globe className="size-3" />} label={countryNames[0]} />}
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {genres.map((g: any) => (
                  <Link key={g.id} href={`/app/moviebygenre/list/${g.id}`} className="px-2.5 py-1 rounded-lg bg-surface-800/60 text-xs text-surface-300 hover:text-white hover:bg-surface-700 transition-colors">
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
                <button onClick={() => navigator.clipboard?.writeText(window.location.href)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-800/60 text-surface-300 hover:text-white border border-surface-700/50 text-sm font-medium transition-colors">
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
                  <DetailBlock label="Director" value={directors.map((d: any) => d.name).join(", ")} />
                )}
                {production && <DetailBlock label="Studio" value={production} />}
                {budget && <DetailBlock label="Budget" value={budget} />}
                {revenue && <DetailBlock label="Revenue" value={revenue} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content below hero */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Where to Watch */}
            <Section title="Where to Watch" subtitle="Streaming options">
              <WatchOptionsViewer mediaId={movie.id} mediaType="movie" />
            </Section>

            {/* Your Activity */}
            <Section title="Your Activity" subtitle="Rate and review">
              <div className="space-y-4">
                <UserRating itemId={movie.id} itemType="movie" itemName={movie.title}
                  imageUrl={movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : undefined}
                  isWatched={isWatched} />
                <WatchedReview itemId={movie.id} itemType="movie" isWatched={isWatched} />
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
              <PublicReviews itemId={String(movie.id)} itemType="movie" />
            </Section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Friends */}
            <FriendsWhoWatched itemId={String(movie.id)} itemType="movie" />
            <RatingDistribution itemId={String(movie.id)} itemType="movie" />

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

            {/* Collection */}
            {collection && (
              <Link href={`/app/movie/${collection.id}`} className="block rounded-xl border border-brand-500/10 bg-brand-500/3 p-4 hover:bg-brand-500/5 transition-colors">
                <h3 className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">Part of Collection</h3>
                <p className="text-sm text-white font-medium">{collection.name}</p>
              </Link>
            )}
          </div>
        </div>

        {/* Media gallery */}
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
