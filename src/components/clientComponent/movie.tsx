"use client";

import React, { useContext, useState } from "react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import ThreeUserPrefrenceBtn from "@components/buttons/threePrefrencebtn";
import { LiaImdb } from "react-icons/lia";
import Link from "next/link";
import MovieCast from "@components/movie/MovieCast";
import Video from "@components/movie/Video";
import { LuSend } from "react-icons/lu";
import SendMessageModal from "@components/message/sendCard";
import ImdbRating from "@components/movie/imdbRating";
import UserRating from "@components/movie/UserRating";
import WatchedReview from "@components/movie/WatchedReview";
import PublicReviews from "@components/movie/PublicReviews";
import ImageViewer from "@components/clientComponent/ImaeViewer";
import WatchOptionsViewer from "./watchOptionView";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
  pt: "Portuguese",
  zh: "Chinese",
  it: "Italian",
};

function langLabel(iso: string): string {
  return LANGUAGE_NAMES[iso] ?? iso?.toUpperCase() ?? "";
}

export default function Movie({
  CountryName,
  movie,
  Bimages,
  Pimages,
  credits,
  videos,
  id,
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

  const toggleOverview = () => {
    setShowFullOverview(!showFullOverview);
  };

  const backdropUrl =
    movie?.backdrop_path && !movie?.adult
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : null;
  const posterUrl =
    movie?.poster_path && !movie?.adult
      ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
      : movie?.adult
        ? "/pixeled.webp"
        : "/no-photo.webp";

  return (
    <div>
      <SendMessageModal
        media_type="movie"
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div className="text-white relative w-full bg-neutral-900 min-h-screen">
        {/* Hero: backdrop + title + tagline */}
        <section className="relative w-full min-h-[320px] md:min-h-[420px] flex flex-col justify-end">
          {backdropUrl && (
            <>
              <img
                src={backdropUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-40"
              />
              <div
                className="absolute inset-0 bg-linear-to-t from-neutral-900 via-neutral-900/60 to-transparent"
                aria-hidden
              />
            </>
          )}
          <div className="relative z-10 max-w-6xl w-full mx-auto px-4 pb-6 md:pb-8">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded bg-amber-500/90 text-neutral-900 text-xs font-semibold uppercase tracking-wide">
                Movie
              </span>
              {movie?.adult && (
                <span className="px-2.5 py-0.5 rounded bg-red-600 text-white text-xs font-semibold">
                  Adult
                </span>
              )}
              {status && (
                <span className="text-neutral-400 text-sm">{status}</span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-md">
              {movie?.title}
            </h1>
            {tagline && (
              <p className="mt-2 text-lg md:text-xl text-neutral-300 italic max-w-2xl">
                {tagline}
              </p>
            )}
            {/* Key facts: TMDB score, votes, date, runtime, language */}
            <div className="mt-4 flex flex-wrap gap-2 md:gap-3 text-sm">
              {voteAvg != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-700/80 text-white">
                  <span className="text-amber-400 font-semibold">★ {voteAvg}</span>
                  {voteCount != null && voteCount > 0 && (
                    <span className="text-neutral-400">({voteCount.toLocaleString()} votes)</span>
                  )}
                </span>
              )}
              {movie?.release_date && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {movie.release_date}
                </span>
              )}
              {movie?.runtime != null && movie.runtime > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {movie.runtime} min
                </span>
              )}
              {origLang && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {origLang}
                </span>
              )}
              {spoken && spoken !== origLang && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {spoken}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Main content: poster + details */}
        <section className="max-w-6xl w-full mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            {/* Poster - left */}
            <div className="shrink-0 w-full lg:w-72 xl:w-80">
              <img
                src={posterUrl}
                alt={movie?.title ?? "Poster"}
                className="w-full rounded-xl shadow-xl object-cover aspect-2/3 max-h-[480px]"
              />
            </div>

            {/* Right: actions, rating, reviews, then overview & details */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Actions: Watched / Favorites / Watchlist / Share */}
              <div className="flex flex-wrap gap-2">
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
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-medium bg-neutral-700/80 text-neutral-200 hover:bg-neutral-600 border border-neutral-600 hover:border-neutral-500 transition-colors shrink-0"
                  aria-label="Share"
                >
                  <LuSend className="text-lg shrink-0" aria-hidden /> Share
                </button>
              </div>

              {/* Country */}
              {Array.isArray(CountryName) && CountryName.length > 0 && (
                <div className="text-sm text-neutral-400">
                  <span className="font-medium text-neutral-300">Country: </span>
                  {CountryName.slice(0, 3).map((item: any, i: number) => (
                    <span key={i}>{item?.[0]?.english_name ?? ""}{i < CountryName.length - 1 ? ", " : ""}</span>
                  ))}
                </div>
              )}

              {/* IMDb */}
              {movie?.imdb_id && (
                <div className="flex items-center gap-2">
                  <LiaImdb className="text-4xl text-amber-400" />
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://imdb.com/title/${movie.imdb_id}`}
                    className="text-neutral-200 hover:text-amber-400 transition"
                  >
                    <ImdbRating id={movie.imdb_id} />
                  </Link>
                </div>
              )}

              {/* Your rating & reviews */}
              <div className="space-y-4 pt-2 border-t border-neutral-700">
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
                <div className="pt-4 border-t border-neutral-700">
                  <h2 className="text-lg font-semibold text-white mb-2">Overview</h2>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    {showFullOverview ? movie.overview : movie.overview.slice(0, 320)}
                    {movie.overview.length > 320 && !showFullOverview && "…"}
                  </p>
                  {movie.overview.length > 320 && (
                    <button
                      type="button"
                      onClick={toggleOverview}
                      className="mt-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                    >
                      {showFullOverview ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {/* Details: Director, Genres, Production, Budget/Revenue */}
              <div className="pt-4 border-t border-neutral-700 space-y-3">
                <h2 className="text-lg font-semibold text-white mb-3">Details</h2>
                {directors.length > 0 && (
                  <div className="text-sm">
                    <span className="text-neutral-500">Director: </span>
                    {directors.map((d: any, i: number) => (
                      <Link
                        key={d.id}
                        href={`/app/person/${d.id}-${String(d.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                        className="text-neutral-200 hover:text-indigo-400 hover:underline"
                      >
                        {d.name}{i < directors.length - 1 ? ", " : ""}
                      </Link>
                    ))}
                  </div>
                )}
                {movie?.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-neutral-500 text-sm">Genres: </span>
                    {movie.genres.map((g: any) => (
                      <Link
                        key={g.id}
                        href={`/app/moviebygenre/list/${g.id}-${String(g.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                        className="px-2.5 py-0.5 rounded-full bg-neutral-700 text-neutral-200 text-sm hover:bg-neutral-600 transition"
                      >
                        {g.name}
                      </Link>
                    ))}
                  </div>
                )}
                {movie?.production_companies?.length > 0 && (
                  <div className="text-sm text-neutral-400">
                    <span className="text-neutral-500">Production: </span>
                    {movie.production_companies.slice(0, 5).map((c: any, i: number) => (
                      <span key={c.id}>{c.name}{i < Math.min(5, movie.production_companies.length) - 1 ? ", " : ""}</span>
                    ))}
                  </div>
                )}
                {hasMoney && (
                  <div className="text-sm text-neutral-400 flex flex-wrap gap-4">
                    {budget > 0 && (
                      <span>Budget: ${(budget / 1_000_000).toFixed(1)}M</span>
                    )}
                    {revenue > 0 && (
                      <span>Revenue: ${(revenue / 1_000_000).toFixed(1)}M</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Full-width sections */}
        <WatchOptionsViewer mediaId={id} mediaType="movie" />
        <MovieCast credits={credits?.cast} id={id} type="movie" />
        <Video videos={videos} movie={movie} />
        <ImageViewer movie={movie} Bimages={Bimages} Pimages={Pimages} />
      </div>
    </div>
  );
}
