"use client";

import React, { useContext, useState } from "react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import ThreeUserPrefrenceBtn from "@components/buttons/threePrefrencebtn";
import { LiaImdb } from "react-icons/lia";
import Link from "next/link";
import MovieCast from "@components/movie/MovieCast";
import Video from "@components/movie/Video";
import { Send, Star, Clock, Globe, DollarSign, Clapperboard, BookOpen } from "lucide-react";
import SendMessageModal from "@components/message/sendCard";
import ImdbRating from "@components/movie/imdbRating";
import UserRating from "@components/movie/UserRating";
import WatchedReview from "@components/movie/WatchedReview";
import PublicReviews from "@components/movie/PublicReviews";
import ImageViewer from "@components/clientComponent/ImageViewer";
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
        {/* ──────── CINEMATIC HERO ──────── */}
        <section id="section-overview" className="relative w-full min-h-[440px] md:min-h-[580px] flex flex-col justify-end overflow-hidden">
          {backdropUrl && (
            <>
              <img src={backdropUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25 scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/70 to-surface-950/10" aria-hidden />
              <div className="absolute inset-0 bg-gradient-to-r from-surface-950/90 via-surface-950/30 to-transparent" aria-hidden />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(34,197,94,0.06),transparent)]" aria-hidden />
            </>
          )}
          <div className="relative z-10 section-container pb-16 md:pb-24 animate-fade-up">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="badge-brand">Movie</span>
              {movie?.adult && (
                <span className="px-2.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/25 text-[10px] font-bold uppercase tracking-wider">18+</span>
              )}
              {status && (
                <span className="text-surface-600 text-xs font-medium uppercase tracking-wider">{status}</span>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-none hero-title-gradient max-w-4xl">
              {movie?.title}
            </h1>
            {tagline && (
              <p className="mt-3 text-base md:text-lg text-surface-500 max-w-2xl leading-relaxed font-light italic">
                &ldquo;{tagline}&rdquo;
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {voteAvg != null && (
                <span className="pill-glass">
                  <Star className="text-accent-gold fill-accent-gold !w-3.5 !h-3.5" />
                  <span className="text-white font-bold">{voteAvg}</span>
                  {voteCount != null && voteCount > 0 && (
                    <span className="text-surface-600 text-xs font-normal">({voteCount.toLocaleString()})</span>
                  )}
                </span>
              )}
              {movie?.release_date && (
                <span className="pill-glass">
                  {new Date(movie.release_date).getFullYear()}
                </span>
              )}
              {movie?.runtime != null && movie.runtime > 0 && (
                <span className="pill-glass">
                  <Clock />
                  {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                </span>
              )}
              {origLang && (
                <span className="pill-glass">
                  <Globe />
                  {origLang}
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5 items-center">
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
                className="btn-secondary"
                aria-label="Share"
              >
                <Send className="text-base shrink-0" /> Share
              </button>
            </div>
          </div>
        </section>

        {/* ──────── MAIN CONTENT ──────── */}
        <section className="section-container -mt-16 md:-mt-20 relative z-20">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
            {/* Poster – premium floating card */}
            <div className="shrink-0 w-full lg:w-72 xl:w-80 animate-fade-up">
              <div className="relative hover-lift rounded-2xl">
                <div className="absolute -inset-1 bg-gradient-to-b from-brand-500/10 to-transparent rounded-2xl blur-xl opacity-50" aria-hidden />
                <img
                  src={posterUrl}
                  alt={movie?.title ?? "Poster"}
                  className="w-full rounded-2xl poster-shadow-lg object-cover aspect-[2/3] max-h-[500px] ring-1 ring-white/10 relative"
                />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 pointer-events-none" />
              </div>
            </div>

            {/* Details Column */}
            <div className="flex-1 min-w-0 flex flex-col gap-6 animate-fade-up stagger-1">
              {/* Country + IMDb */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                {Array.isArray(CountryName) && CountryName.length > 0 && (
                  <span className="text-surface-500">
                    <span className="text-surface-400 font-medium">Country: </span>
                    {CountryName.slice(0, 3).map((item: any, i: number) => (
                      <span key={i}>
                        {item?.[0]?.english_name ?? ""}
                        {i < Math.min(3, CountryName.length) - 1 ? ", " : ""}
                      </span>
                    ))}
                  </span>
                )}
                {movie?.imdb_id && (
                  <span className="flex items-center gap-1.5">
                    <LiaImdb className="text-xl text-accent-gold" />
                    <Link
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://imdb.com/title/${movie.imdb_id}`}
                      className="text-surface-400 hover:text-accent-gold transition-colors text-sm font-medium"
                    >
                      <ImdbRating id={movie.imdb_id} />
                    </Link>
                  </span>
                )}
              </div>

              {/* Overview */}
              {movie?.overview && (
                <div className="card-accent rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-brand-400" />
                    <span className="text-xs font-semibold text-surface-100 uppercase tracking-wider">Overview</span>
                  </div>
                  <p className="text-sm text-surface-400 leading-relaxed">
                    {showFullOverview ? movie.overview : movie.overview.slice(0, 320)}
                    {movie.overview.length > 320 && !showFullOverview && "…"}
                  </p>
                  {movie.overview.length > 320 && (
                    <button
                      type="button"
                      onClick={toggleOverview}
                      className="mt-3 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      {showFullOverview ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Details */}
              <div className="card-accent rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clapperboard className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-semibold text-surface-100 uppercase tracking-wider">Details</span>
                </div>
                <div className="space-y-3">
                  {directors.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-surface-500 shrink-0">Director:</span>
                      <div className="flex flex-wrap gap-1">
                        {directors.map((d: any, i: number) => (
                          <Link
                            key={d.id}
                            href={`/app/person/${d.id}-${String(d.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                            className="text-surface-300 hover:text-brand-400 transition-colors"
                          >
                            {d.name}{i < directors.length - 1 ? "," : ""}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {movie?.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {movie.genres.map((g: any) => (
                        <Link
                          key={g.id}
                          href={`/app/moviebygenre/list/${g.id}-${String(g.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                          className="chip-surface"
                        >
                          {g.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {movie?.production_companies?.length > 0 && (
                    <div className="text-sm text-surface-500">
                      <span className="text-surface-500">Production: </span>
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
                          <DollarSign className="w-3.5 h-3.5 text-surface-600" />
                          Budget: ${(budget / 1_000_000).toFixed(1)}M
                        </span>
                      )}
                      {revenue > 0 && (
                        <span className="flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-surface-600" />
                          Revenue: ${(revenue / 1_000_000).toFixed(1)}M
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Your Activity */}
          <div id="section-ratings" className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="section-header">Your Activity</h2>
                <p className="section-desc">Rate, review, and track</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <UserRating
                itemId={id}
                itemType="movie"
                itemName={movie?.title}
                imageUrl={movie?.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : undefined}
                isWatched={hasWatched(id)}
              />
              <WatchedReview itemId={id} itemType="movie" isWatched={hasWatched(id)} />
            </div>
          </div>

          {/* Community */}
          <div id="section-social" className="mt-12 space-y-5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="section-header">Community</h2>
                <p className="section-desc">See what friends think</p>
              </div>
            </div>
            <FriendsWhoWatched itemId={id} itemType="movie" />
            <RatingDistribution itemId={id} itemType="movie" />
          </div>

          {/* Community Reviews */}
          <div id="section-reviews" className="mt-12">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="section-header">Community Reviews</h2>
                <p className="section-desc">Everyone&apos;s thoughts</p>
              </div>
            </div>
            <PublicReviews itemId={id} itemType="movie" />
          </div>
        </section>

        {/* ──────── FULL WIDTH SECTIONS ──────── */}
        <div className="bg-gradient-section mt-12">
          <div id="section-cast">
            <WatchOptionsViewer mediaId={id} mediaType="movie" />
            <MovieCast credits={credits?.cast} id={id} type="movie" />
          </div>

          {/* Explore More */}
          <section className="section-container section-spacing">
            <div id="section-more" className="space-y-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
                <div>
                  <h2 className="section-header">Explore More</h2>
                  <p className="section-desc">Related content and themes</p>
                </div>
              </div>
              <CollectionBanner collection={collection} />
              <KeywordTags keywords={keywords} />
            </div>
          </section>
        </div>

        {/* Media */}
        <div id="section-media">
          <Video videos={videos} movie={movie} />
          <ImageViewer movie={movie} Bimages={Bimages} Pimages={Pimages} />
        </div>
      </div>
    </div>
  );
}
