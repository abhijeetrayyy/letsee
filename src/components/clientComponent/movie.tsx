"use client";

import React, { useContext, useState } from "react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import ThreeUserPrefrenceBtn from "@components/buttons/threePrefrencebtn";
import { LiaImdb } from "react-icons/lia";
import Link from "next/link";
import MovieCast from "@components/movie/MovieCast";
import Video from "@components/movie/Video";
import { Send, Star, Clock, Globe, DollarSign, Clapperboard, Hash, Sparkles, TrendingUp } from "lucide-react";
import SendMessageModal from "@components/message/sendCard";
import ImdbRating from "@components/movie/imdbRating";
import UserRating from "@components/movie/UserRating";
import WatchedReview from "@components/movie/WatchedReview";
import PublicReviews from "@components/movie/PublicReviews";
import ImageViewer from "@components/clientComponent/ImaeViewer";
import WatchOptionsViewer from "./watchOptionView";
import FriendsWhoWatched from "@components/detail/FriendsWhoWatched";
import RatingDistribution from "@components/detail/RatingDistribution";
import CollectionBanner from "@components/detail/CollectionBanner";
import KeywordTags from "@components/detail/KeywordTags";
import ContentAdvisory from "@components/detail/ContentAdvisory";
import SectionNav from "@components/detail/SectionNav";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", ko: "Korean", hi: "Hindi", pt: "Portuguese",
  zh: "Chinese", it: "Italian",
};

function langLabel(iso: string): string {
  return LANGUAGE_NAMES[iso] ?? iso?.toUpperCase() ?? "";
}

export default function Movie({
  CountryName, movie, Bimages, Pimages, credits, videos, id,
  keywords = [], collection = null, releaseDates = [],
}: any) {
  const { hasWatched } = useContext(UserPrefrenceContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState([]) as any;
  const [showFullOverview, setShowFullOverview] = useState(false);

  const movieGenres = Array.isArray(movie?.genres) ? movie.genres : [];
  const directors = credits?.crew?.filter((c: any) => c.job === "Director") ?? [];
  const tagline = movie?.tagline?.trim();
  const voteAvg = movie?.vote_average != null ? Number(movie.vote_average).toFixed(1) : null;
  const voteCount = movie?.vote_count;
  const status = movie?.status;
  const origLang = movie?.original_language ? langLabel(movie.original_language) : null;
  const spoken = movie?.spoken_languages?.length
    ? movie.spoken_languages.map((s: any) => s.english_name || s.name).slice(0, 3).join(", ")
    : null;
  const budget = movie?.budget ? Number(movie.budget) : 0;
  const revenue = movie?.revenue ? Number(movie.revenue) : 0;
  const hasMoney = budget > 0 || revenue > 0;

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const toggleOverview = () => setShowFullOverview(!showFullOverview);

  const backdropUrl = movie?.backdrop_path && !movie?.adult
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null;
  const posterUrl = movie?.poster_path && !movie?.adult
    ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
    : movie?.adult ? "/pixeled.webp" : "/no-photo.webp";

  return (
    <div>
      <SectionNav />
      <SendMessageModal media_type="movie" data={cardData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="text-white relative w-full bg-surface-950 min-h-screen">
        {/* Hero with backdrop */}
        <section id="section-overview" className="relative w-full min-h-[380px] md:min-h-[500px] flex flex-col justify-end">
          {backdropUrl && (
            <>
              <img src={backdropUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/50 to-transparent" aria-hidden />
              <div className="absolute inset-0 bg-gradient-to-r from-surface-950/70 via-transparent to-transparent" aria-hidden />
            </>
          )}
          <div className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 pb-8 md:pb-10">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-md bg-brand-500/90 text-surface-950 text-xs font-bold uppercase tracking-wider">
                Movie
              </span>
              {movie?.adult && (
                <span className="px-2.5 py-0.5 rounded-md bg-red-500/90 text-white text-xs font-bold">18+</span>
              )}
              {status && (
                <span className="text-surface-400 text-sm font-medium">{status}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {movie?.title}
            </h1>
            {tagline && (
              <p className="mt-2 text-base md:text-lg text-surface-400 italic max-w-2xl">
                {tagline}
              </p>
            )}

            {/* Key facts */}
            <div className="mt-4 flex flex-wrap gap-2 md:gap-3">
              {voteAvg != null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800/80 border border-surface-700/40 text-sm">
                  <Star className="w-4 h-4 text-accent-gold fill-accent-gold" />
                  <span className="text-white font-semibold">{voteAvg}</span>
                  {voteCount != null && voteCount > 0 && (
                    <span className="text-surface-500 text-xs">({voteCount.toLocaleString()})</span>
                  )}
                </span>
              )}
              {movie?.release_date && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800/80 border border-surface-700/40 text-surface-300 text-sm">
                  {new Date(movie.release_date).getFullYear()}
                </span>
              )}
              {movie?.runtime != null && movie.runtime > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800/80 border border-surface-700/40 text-surface-300 text-sm">
                  <Clock className="w-3.5 h-3.5 text-surface-500" />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              )}
              {origLang && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800/80 border border-surface-700/40 text-surface-300 text-sm">
                  <Globe className="w-3.5 h-3.5 text-surface-500" />
                  {origLang}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Main content */}
        <section className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 md:py-12">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
            {/* Poster */}
            <div className="shrink-0 w-full lg:w-72 xl:w-80">
              <img
                src={posterUrl}
                alt={movie?.title ?? "Poster"}
                className="w-full rounded-2xl poster-shadow object-cover aspect-2/3 max-h-[480px]"
              />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 space-y-6">
            {/* Actions */}
            <div id="section-actions" className="flex flex-wrap gap-2">
                <ThreeUserPrefrenceBtn
                  variant="detail"
                  genres={movieGenres.map((g: any) => g.name)}
                  cardId={movie?.id}
                  cardType="movie"
                  cardName={movie?.name || movie?.title}
                  cardAdult={movie?.adult}
                  cardImg={movie?.poster_path || movie?.backdrop_path}
                />
                <button
                  type="button"
                  onClick={() => handleCardTransfer(movie)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-surface-800/80 text-surface-300 hover:bg-surface-700 hover:text-white border border-surface-700/40 transition-all"
                  aria-label="Share"
                >
                  <Send className="text-base shrink-0" aria-hidden /> Share
                </button>
              </div>

              {/* Country */}
              {Array.isArray(CountryName) && CountryName.length > 0 && (
                <div className="text-sm text-surface-400">
                  <span className="font-medium text-surface-300">Country: </span>
                  {CountryName.slice(0, 3).map((item: any, i: number) => (
                    <span key={i}>
                      {item?.[0]?.english_name ?? ""}
                      {i < Math.min(3, CountryName.length) - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              )}

              {/* IMDb */}
              {movie?.imdb_id && (
                <div className="flex items-center gap-3">
                  <LiaImdb className="text-4xl text-accent-gold" />
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://imdb.com/title/${movie.imdb_id}`}
                    className="text-surface-300 hover:text-accent-gold transition-colors text-sm font-medium"
                  >
                    <ImdbRating id={movie.imdb_id} />
                  </Link>
                </div>
              )}

              {/* Rating & Reviews */}
              <div id="section-ratings" className="space-y-4 pt-4 border-t border-surface-800/50">
                <UserRating
                  itemId={id}
                  itemType="movie"
                  itemName={movie?.title}
                  imageUrl={movie?.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : undefined}
                  isWatched={hasWatched(id)}
                />
                <WatchedReview itemId={id} itemType="movie" isWatched={hasWatched(id)} />
                <PublicReviews itemId={id} itemType="movie" />
              </div>

              {/* Overview */}
              {movie?.overview && (
                <div className="pt-4 border-t border-surface-800/50">
                  <h2 className="text-lg font-semibold text-white mb-3">Overview</h2>
                  <p className="text-surface-400 text-sm leading-relaxed">
                    {showFullOverview ? movie.overview : movie.overview.slice(0, 320)}
                    {movie.overview.length > 320 && !showFullOverview && "…"}
                  </p>
                  {movie.overview.length > 320 && (
                    <button
                      type="button"
                      onClick={toggleOverview}
                      className="mt-3 text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
                    >
                      {showFullOverview ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Details */}
              <div className="pt-4 border-t border-surface-800/50 space-y-4">
                <h2 className="text-lg font-semibold text-white mb-2">Details</h2>
                {directors.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Clapperboard className="w-4 h-4 text-surface-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-surface-500">Director: </span>
                      {directors.map((d: any, i: number) => (
                        <Link
                          key={d.id}
                          href={`/app/person/${d.id}-${String(d.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                          className="text-surface-300 hover:text-brand-400 hover:underline transition-colors"
                        >
                          {d.name}{i < directors.length - 1 ? ", " : ""}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {movie?.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.map((g: any) => (
                      <Link
                        key={g.id}
                        href={`/app/moviebygenre/list/${g.id}-${String(g.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                        className="px-3 py-1 rounded-full bg-surface-800/60 border border-surface-700/40 text-surface-300 text-xs font-medium hover:bg-surface-700 hover:text-white hover:border-surface-600 transition-all"
                      >
                        {g.name}
                      </Link>
                    ))}
                  </div>
                )}
                {movie?.production_companies?.length > 0 && (
                  <div className="text-sm text-surface-500">
                    <span className="text-surface-600">Production: </span>
                    {movie.production_companies.slice(0, 5).map((c: any, i: number) => (
                      <span key={c.id}>
                        {c.name}
                        {i < Math.min(5, movie.production_companies.length) - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                )}
                {hasMoney && (
                  <div className="flex flex-wrap gap-4 text-sm text-surface-500">
                    {budget > 0 && (
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        Budget: ${(budget / 1_000_000).toFixed(1)}M
                      </span>
                    )}
                    {revenue > 0 && (
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        Revenue: ${(revenue / 1_000_000).toFixed(1)}M
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Social Proof Section */}
          <div id="section-social" className="mt-8 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <h2 className="text-lg font-semibold text-white">Community</h2>
            </div>
            <FriendsWhoWatched itemId={id} itemType="movie" />
            <RatingDistribution itemId={id} itemType="movie" />
          </div>

          {/* More Content Section */}
          <div id="section-more" className="mt-8 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-brand-400" />
              <h2 className="text-lg font-semibold text-white">Explore More</h2>
            </div>
            <CollectionBanner collection={collection} />
            <KeywordTags keywords={keywords} />
          </div>
        </section>

        {/* Full-width sections */}
        <div id="section-cast">
          <WatchOptionsViewer mediaId={id} mediaType="movie" />
        </div>
        <div id="section-media">
          <MovieCast credits={credits?.cast} id={id} type="movie" />
          <Video videos={videos} movie={movie} />
          <ImageViewer movie={movie} Bimages={Bimages} Pimages={Pimages} />
        </div>
      </div>
    </div>
  );
}
