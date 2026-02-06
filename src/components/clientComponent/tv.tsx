"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import ThreePrefrenceBtn from "@components/buttons/threePrefrencebtn";
import { LiaImdb } from "react-icons/lia";
import Link from "next/link";
import MovieCast from "@components/movie/MovieCast";
import Video from "@components/movie/Video";
import SendMessageModal from "@components/message/sendCard";
import { LuSend } from "react-icons/lu";
import ImageViewer from "@components/clientComponent/ImaeViewer";
import ImdbRating from "@components/movie/imdbRating";
import UserRating from "@components/movie/UserRating";
import WatchedReview from "@components/movie/WatchedReview";
import PublicReviews from "@components/movie/PublicReviews";
import TvShowProgress from "@components/tv/TvShowProgress";
import MarkTVWatchedModal from "@components/tv/MarkTVWatchedModal";
import WatchOptionsViewer from "@components/clientComponent/watchOptionView";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

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

export default function Tv({
  cast,
  videos,
  ExternalIDs,
  show,
  id,
  Pimages,
  Bimages,
}: any) {
  const { hasWatched, refreshPreferences } = useContext(UserPrefrenceContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>([]);
  const [markTVWatchedModalOpen, setMarkTVWatchedModalOpen] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [tvListStatus, setTvListStatus] = useState<string | null>(null);
  const [tvListStatusUpdating, setTvListStatusUpdating] = useState(false);
  const showGenres = Array.isArray(show?.genres) ? show.genres : [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el) {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll);
      setTimeout(handleScroll, 100);
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [show]);

  const watched = hasWatched(id);
  useEffect(() => {
    if (!watched) {
      setTvListStatus(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/tv-list-status?showId=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.status != null) setTvListStatus(data.status);
        else if (!cancelled) setTvListStatus(null);
      })
      .catch(() => { if (!cancelled) setTvListStatus(null); });
    return () => { cancelled = true; };
  }, [id, watched]);

  const handleCardTransfer = (data: any) => {
    setCardData(data);
    setIsModalOpen(true);
  };

  const toggleOverview = () => setShowFullOverview(!showFullOverview);

  const seasons = Array.isArray(show?.seasons)
    ? show.seasons.filter((s: any) => s.name !== "Specials")
    : [];
  const seasonsForModal = seasons.map((s: any) => ({
    season_number: Number(s.season_number),
    name: String(s.name ?? `Season ${s.season_number}`),
    episode_count: Number(s.episode_count) || 0,
  }));
  const firstSeason = seasons[0];
  const otherSeasons = seasons.slice(1);

  const tagline = show?.tagline?.trim();
  const hideVoting = process.env.NEXT_PUBLIC_HIDE_VOTING === "true";
  const voteAvg = hideVoting ? null : (show?.vote_average != null ? Number(show.vote_average).toFixed(1) : null);
  const voteCount = hideVoting ? null : show?.vote_count;
  const status = show?.status;
  const type = show?.type;
  const origLang = show?.original_language ? langLabel(show.original_language) : null;
  const networks = show?.networks ?? [];
  const createdBy = show?.created_by ?? [];
  const numSeasons = show?.number_of_seasons;
  const numEpisodes = show?.number_of_episodes;
  const firstAir = show?.first_air_date;
  const lastAir = show?.last_air_date;

  const backdropUrl =
    show?.backdrop_path && !show?.adult
      ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}`
      : null;
  const posterUrl =
    show?.adult
      ? "/pixeled.webp"
      : show?.poster_path
        ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
        : "/no-photo.webp";

  return (
    <div>
      <SendMessageModal
        media_type="tv"
        data={cardData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <MarkTVWatchedModal
        showId={String(id)}
        showName={show?.name || show?.title || ""}
        seasons={seasonsForModal}
        isOpen={markTVWatchedModalOpen}
        onClose={() => setMarkTVWatchedModalOpen(false)}
        onSuccess={() => refreshPreferences()}
        watchedPayload={{
          itemId: show?.id ?? id,
          name: show?.name || show?.title || "",
          imgUrl: show?.poster_path || show?.backdrop_path ? `https://image.tmdb.org/t/p/w342${show?.poster_path || show?.backdrop_path}` : "",
          adult: show?.adult ?? false,
          genres: showGenres.map((g: any) => g.name),
        }}
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
              <span className="px-2.5 py-0.5 rounded bg-indigo-500/90 text-white text-xs font-semibold uppercase tracking-wide">
                TV Series
              </span>
              {show?.adult && (
                <span className="px-2.5 py-0.5 rounded bg-red-600 text-white text-xs font-semibold">
                  Adult
                </span>
              )}
              {status && (
                <span className="text-neutral-400 text-sm">{status}</span>
              )}
              {type && (
                <span className="text-neutral-400 text-sm">{type}</span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-md">
              {show?.name}
            </h1>
            {tagline && (
              <p className="mt-2 text-lg md:text-xl text-neutral-300 italic max-w-2xl">
                {tagline}
              </p>
            )}
            {/* Key facts */}
            <div className="mt-4 flex flex-wrap gap-2 md:gap-3 text-sm">
              {voteAvg != null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-700/80 text-white">
                  <span className="text-amber-400 font-semibold">★ {voteAvg}</span>
                  {voteCount != null && voteCount > 0 && (
                    <span className="text-neutral-400">({voteCount.toLocaleString()} votes)</span>
                  )}
                </span>
              )}
              {firstAir && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {firstAir}
                  {lastAir && lastAir !== firstAir ? ` – ${lastAir}` : ""}
                </span>
              )}
              {numSeasons != null && numSeasons > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {numSeasons} season{numSeasons !== 1 ? "s" : ""}
                </span>
              )}
              {numEpisodes != null && numEpisodes > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {numEpisodes} episodes
                </span>
              )}
              {origLang && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {origLang}
                </span>
              )}
              {networks.length > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-neutral-700/80 text-neutral-200">
                  {networks.slice(0, 2).map((n: any) => n.name).join(", ")}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Main content: poster + details */}
        <section className="max-w-6xl w-full mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            <div className="shrink-0 w-full lg:w-72 xl:w-80">
              <img
                src={posterUrl}
                alt={show?.name ?? "Poster"}
                className="w-full rounded-xl shadow-xl object-cover aspect-2/3 max-h-[480px]"
              />
            </div>

            <div className="flex-1 min-w-0 space-y-6">
              {/* Actions: Watched / Favorites / Watchlist / Share */}
              <div className="flex flex-wrap gap-2">
                <ThreePrefrenceBtn
                  variant="detail"
                  genres={showGenres.map((g: any) => g.name)}
                  cardId={show?.id}
                  cardType="tv"
                  cardName={show?.name || show?.title}
                  cardAdult={show?.adult}
                  cardImg={show?.poster_path || show?.backdrop_path}
                  onAddWatchedTv={() => setMarkTVWatchedModalOpen(true)}
                />
                <button
                  type="button"
                  onClick={() => handleCardTransfer(show)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-base font-medium bg-neutral-700/80 text-neutral-200 hover:bg-neutral-600 border border-neutral-600 hover:border-neutral-500 transition-colors shrink-0"
                  aria-label="Share"
                >
                  <LuSend className="text-lg shrink-0" aria-hidden /> Share
                </button>
              </div>

              {/* IMDb */}
              {ExternalIDs?.imdb_id && (
                <div className="flex items-center gap-2">
                  <LiaImdb className="text-4xl text-amber-400" />
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://imdb.com/title/${ExternalIDs.imdb_id}`}
                    className="text-neutral-200 hover:text-amber-400 transition"
                  >
                    <ImdbRating id={ExternalIDs.imdb_id} />
                  </Link>
                </div>
              )}

              {/* Your rating & reviews */}
              <div className="space-y-4 pt-2 border-t border-neutral-700">
                {hasWatched(id) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-neutral-400">Your list:</span>
                    <select
                      value={tvListStatus ?? "watching"}
                      onChange={async (e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setTvListStatusUpdating(true);
                        try {
                          const res = await fetch("/api/tv-list-status", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ showId: String(id), status: v }),
                          });
                          if (res.ok) setTvListStatus(v);
                        } finally {
                          setTvListStatusUpdating(false);
                        }
                      }}
                      disabled={tvListStatusUpdating}
                      className="rounded-lg border border-neutral-600 bg-neutral-800 text-neutral-200 text-sm py-1.5 px-2 disabled:opacity-50"
                    >
                      <option value="watching">Watching</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On hold</option>
                      <option value="dropped">Dropped</option>
                      <option value="plan_to_watch">Plan to watch</option>
                    </select>
                  </div>
                )}
                <TvShowProgress showId={id} />
                <UserRating
                  itemId={id}
                  itemType="tv"
                  itemName={show?.name}
                  imageUrl={show?.poster_path ? `https://image.tmdb.org/t/p/w92${show.poster_path}` : undefined}
                  isWatched={hasWatched(id)}
                />
                <WatchedReview itemId={id} itemType="tv" isWatched={hasWatched(id)} />
                <PublicReviews itemId={id} itemType="tv" />
              </div>

              {/* Overview */}
              {show?.overview && (
                <div className="pt-4 border-t border-neutral-700">
                  <h2 className="text-lg font-semibold text-white mb-2">Overview</h2>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    {showFullOverview ? show.overview : show.overview.slice(0, 320)}
                    {show.overview.length > 320 && !showFullOverview && "…"}
                  </p>
                  {show.overview.length > 320 && (
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

              {/* Details */}
              <div className="pt-4 border-t border-neutral-700 space-y-3">
                <h2 className="text-lg font-semibold text-white mb-3">Details</h2>
                {firstAir && (
                  <div className="text-sm text-neutral-400">
                    First air: {firstAir}
                    {lastAir && lastAir !== firstAir && ` · Last air: ${lastAir}`}
                  </div>
                )}
                {status && (
                  <div className="text-sm text-neutral-400">Status: {status}</div>
                )}
                {createdBy.length > 0 && (
                  <div className="text-sm">
                    <span className="text-neutral-500">Created by: </span>
                    {createdBy.map((c: any, i: number) => (
                      <Link
                        key={c.id}
                        href={`/app/person/${c.id}-${String(c.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                        className="text-neutral-200 hover:text-indigo-400 hover:underline"
                      >
                        {c.name}{i < createdBy.length - 1 ? ", " : ""}
                      </Link>
                    ))}
                  </div>
                )}
                {show?.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-neutral-500 text-sm">Genres: </span>
                    {show.genres.map((g: any) => (
                      <Link
                        key={g.id}
                        href={`/app/tvbygenre/list/${g.id}-${g.name}`}
                        className="px-2.5 py-0.5 rounded-full bg-neutral-700 text-neutral-200 text-sm hover:bg-neutral-600 transition"
                      >
                        {g.name}
                      </Link>
                    ))}
                  </div>
                )}
                {show?.production_companies?.length > 0 && (
                  <div className="text-sm text-neutral-400">
                    <span className="text-neutral-500">Production: </span>
                    {show.production_companies.slice(0, 5).map((c: any, i: number) => (
                      <span key={c.id}>{c.name}{i < Math.min(5, show.production_companies.length) - 1 ? ", " : ""}</span>
                    ))}
                  </div>
                )}
                {networks.length > 0 && (
                  <div className="text-sm text-neutral-400">
                    <span className="text-neutral-500">Networks: </span>
                    {networks.map((n: any, i: number) => (
                      <span key={n.id}>{n.name}{i < networks.length - 1 ? ", " : ""}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <WatchOptionsViewer mediaId={Number(id)} mediaType="tv" country="US" />
        <MovieCast credits={cast} id={show?.id ?? id} type="tv" />

        {/* Seasons */}
        {seasons.length > 0 && (
          <section className="max-w-6xl w-full mx-auto px-4 py-8">
            <h2 className="text-2xl font-bold text-white mb-4">Seasons</h2>
            {firstSeason && (
              <div className="mb-6 rounded-xl overflow-hidden border border-neutral-700 bg-neutral-800/80">
                <Link
                  href={`/app/tv/${id}/season/${firstSeason.season_number}`}
                  className="flex flex-col sm:flex-row gap-4 p-4 hover:bg-neutral-800 transition-colors"
                >
                  <img
                    src={
                      firstSeason.poster_path && !show?.adult
                        ? `https://image.tmdb.org/t/p/w342${firstSeason.poster_path}`
                        : "/no-photo.webp"
                    }
                    alt={firstSeason.name}
                    className="rounded-lg object-cover w-full sm:w-40 aspect-video sm:aspect-2/3"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-white">{firstSeason.name}</h3>
                    <p className="text-sm text-neutral-400 mt-1">
                      {firstSeason.air_date || "TBA"} · {firstSeason.episode_count} episodes
                    </p>
                    {firstSeason.overview && (
                      <p className="text-sm text-neutral-300 mt-2 line-clamp-3">{firstSeason.overview}</p>
                    )}
                  </div>
                </Link>
              </div>
            )}
            {otherSeasons.length > 0 && (
              <div className="relative">
                <div
                  ref={scrollRef}
                  className="flex gap-4 overflow-x-auto pb-2 no-scrollbar"
                >
                  {otherSeasons.map((season: any) => (
                    <Link
                      href={`/app/tv/${id}/season/${season.season_number}`}
                      key={season.id}
                      className="shrink-0 w-36 flex flex-col gap-2 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-800/80 hover:border-neutral-600 transition"
                    >
                      <img
                        src={
                          season.poster_path && !show?.adult
                            ? `https://image.tmdb.org/t/p/w185${season.poster_path}`
                            : "/no-photo.webp"
                        }
                        alt={season.name}
                        className="w-full aspect-2/3 object-cover"
                      />
                      <div className="p-2">
                        <h4 className="text-sm font-semibold text-white truncate">{season.name}</h4>
                        <p className="text-xs text-neutral-400">{season.air_date || "TBA"}</p>
                        <p className="text-xs text-neutral-400">{season.episode_count} episodes</p>
                      </div>
                    </Link>
                  ))}
                </div>
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-neutral-800 border border-neutral-600 text-white shadow-lg hover:bg-neutral-700"
                    aria-label="Scroll left"
                  >
                    <FaChevronLeft size={18} />
                  </button>
                )}
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-neutral-800 border border-neutral-600 text-white shadow-lg hover:bg-neutral-700"
                    aria-label="Scroll right"
                  >
                    <FaChevronRight size={18} />
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        <Video videos={videos} movie={show} />
        <ImageViewer movie={show} Bimages={Bimages} Pimages={Pimages} />
      </div>
    </div>
  );
}
