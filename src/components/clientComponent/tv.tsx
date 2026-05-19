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
import { Star, Clock, Globe, Tv, BookOpen, Sparkles, Play, Share2, X, Send } from "lucide-react";
import ImageViewer from "@components/clientComponent/ImageViewer";
import ImdbRating from "@components/movie/imdbRating";
import UserRating from "@components/movie/UserRating";
import WatchedReview from "@components/movie/WatchedReview";
import PublicReviews from "@components/movie/PublicReviews";
import TvShowProgress from "@components/tv/TvShowProgress";
import MarkTVWatchedModal from "@components/tv/MarkTVWatchedModal";
import WatchOptionsViewer from "@components/clientComponent/watchOptionView";
import FriendsWhoWatched from "@components/detail/FriendsWhoWatched";
import RatingDistribution from "@components/detail/RatingDistribution";
import KeywordTags from "@components/detail/KeywordTags";
import ContentAdvisory from "@components/detail/ContentAdvisory";
import SectionNav from "@components/detail/SectionNav";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa6";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", ko: "Korean", hi: "Hindi", pt: "Portuguese",
  zh: "Chinese", it: "Italian",
};

function langLabel(iso: string): string {
  return LANGUAGE_NAMES[iso] ?? iso?.toUpperCase() ?? "";
}

const PROVIDER_FALLBACK: Record<number, string> = {
  8: "https://www.netflix.com",
  9: "https://www.amazon.com/Prime-Video",
  15: "https://www.hulu.com",
  337: "https://www.disneyplus.com",
  350: "https://www.hbomax.com",
  386: "https://www.paramountplus.com",
  531: "https://www.mubi.com",
};

export default function TvDetail({
  cast, videos, ExternalIDs, show, id, Pimages, Bimages,
  keywords = [], contentRatings = [],
  watchProviders = [], watchLink = "",
}: any) {
  const { hasWatched, refreshPreferences } = useContext(UserPrefrenceContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cardData, setCardData] = useState<any>([]);
  const [markTVWatchedModalOpen, setMarkTVWatchedModalOpen] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [tvListStatus, setTvListStatus] = useState<string | null>(null);
  const [tvListStatusUpdating, setTvListStatusUpdating] = useState(false);
  const [trailerModal, setTrailerModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [quickRate, setQuickRate] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const showGenres = Array.isArray(show?.genres) ? show.genres : [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [refreshProgressKey, setRefreshProgressKey] = useState(0);

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
    if (!watched) { setTvListStatus(null); return; }
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

  const trailer = videos?.find((v: any) => v.type === "Trailer" && v.site === "YouTube") ??
    videos?.find((v: any) => v.site === "YouTube");

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  };

  const handleQuickRate = (rating: number) => {
    setUserRating(rating);
    setQuickRate(false);
  };

  const seasons = Array.isArray(show?.seasons)
    ? show.seasons.filter((s: any) => s.name !== "Specials") : [];
  const seasonsForModal = seasons.map((s: any) => ({
    season_number: Number(s.season_number),
    name: String(s.name ?? `Season ${s.season_number}`),
    episode_count: Number(s.episode_count) || 0,
  }));
  const firstSeason = seasons[0];
  const otherSeasons = seasons.slice(1);

  const tagline = show?.tagline?.trim();
  const voteAvg = show?.vote_average != null ? Number(show.vote_average).toFixed(1) : null;
  const voteCount = show?.vote_count;
  const status = show?.status;
  const type = show?.type;
  const origLang = show?.original_language ? langLabel(show.original_language) : null;
  const networks = show?.networks ?? [];
  const createdBy = show?.created_by ?? [];
  const numSeasons = show?.number_of_seasons;
  const numEpisodes = show?.number_of_episodes;
  const firstAir = show?.first_air_date;
  const lastAir = show?.last_air_date;

  const backdropUrl = show?.backdrop_path && !show?.adult
    ? `https://image.tmdb.org/t/p/w1280${show.backdrop_path}` : null;
  const posterUrl = show?.adult ? "/pixeled.webp"
    : show?.poster_path ? `https://image.tmdb.org/t/p/w342${show.poster_path}` : "/no-photo.webp";

  return (
    <div>
      <SectionNav />
      <SendMessageModal media_type="tv" data={cardData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Trailer Modal */}
      {trailerModal && trailer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setTrailerModal(false)}>
          <div className="relative w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setTrailerModal(false)} className="absolute -top-10 right-0 text-white hover:text-brand-400 transition-colors" aria-label="Close trailer">
              <X className="w-6 h-6" />
            </button>
            <div className="aspect-video rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl">
              <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`} title={trailer.name} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <p className="text-sm text-surface-400 mt-3 text-center">{trailer.name}</p>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShareModal(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm mx-4 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Share</h3>
              <button onClick={() => setShareModal(false)} className="text-surface-400 hover:text-white transition-colors" aria-label="Close share">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button onClick={handleShare} className="w-full btn-secondary text-sm py-2.5">
                <Share2 className="w-4 h-4" /> Copy Link
              </button>
              <button onClick={() => window.open(`https://twitter.com/intent/tweet?text=Check out ${show?.name}&url=${encodeURIComponent(window.location.href)}`, "_blank")} className="w-full btn-secondary text-sm py-2.5">
                Share on X
              </button>
              <button onClick={() => handleCardTransfer(show)} className="w-full btn-secondary text-sm py-2.5">
                <Send className="w-4 h-4" /> Send via Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Rate Modal */}
      {quickRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setQuickRate(false)}>
          <div className="glass-card rounded-2xl p-6 w-full max-w-sm mx-4 animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Rate this show</h3>
              <button onClick={() => setQuickRate(false)} className="text-surface-400 hover:text-white transition-colors" aria-label="Close rating">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button key={n} onClick={() => handleQuickRate(n)} className={`rounded-xl py-3 text-lg font-bold transition-all hover:scale-105 ${n <= 3 ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : n <= 6 ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <MarkTVWatchedModal
        showId={String(id)}
        showName={show?.name || show?.title || ""}
        seasons={seasonsForModal}
        isOpen={markTVWatchedModalOpen}
        onClose={() => setMarkTVWatchedModalOpen(false)}
        onSuccess={() => { refreshPreferences(); setRefreshProgressKey((p) => p + 1); }}
        watchedPayload={{
          itemId: show?.id ?? id, name: show?.name || show?.title || "",
          imgUrl: show?.poster_path || show?.backdrop_path
            ? `https://image.tmdb.org/t/p/w342${show?.poster_path || show?.backdrop_path}` : "",
          adult: show?.adult ?? false,
          genres: showGenres.map((g: any) => g.name),
        }}
      />
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
              <span className="badge-brand">TV Series</span>
              {show?.adult && (
                <span className="px-2.5 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/25 text-[10px] font-bold uppercase tracking-wider">18+</span>
              )}
              {status && <span className="text-surface-600 text-xs font-medium uppercase tracking-wider">{status}</span>}
              {type && <span className="text-surface-600 text-xs font-medium uppercase tracking-wider">{type}</span>}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight leading-none hero-title-gradient max-w-4xl">
              {show?.name}
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
              {firstAir && (
                <span className="pill-glass">
                  {firstAir}{lastAir && lastAir !== firstAir ? ` – ${lastAir}` : ""}
                </span>
              )}
              {numSeasons != null && numSeasons > 0 && (
                <span className="pill-glass">
                  {numSeasons} season{numSeasons !== 1 ? "s" : ""}
                </span>
              )}
              {numEpisodes != null && numEpisodes > 0 && (
                <span className="pill-glass">
                  {numEpisodes} episodes
                </span>
              )}
              {origLang && (
                <span className="pill-glass">
                  <Globe />
                  {origLang}
                </span>
              )}
              {networks.length > 0 && (
                <span className="pill-glass">
                  {networks.slice(0, 2).map((n: any) => n.name).join(", ")}
                </span>
              )}
              {show?.next_episode_to_air && (
                <span className="pill-glass !border-brand-500/30 !text-brand-300">
                  <Clock className="!w-3.5 !h-3.5" />
                  Next: {show.next_episode_to_air.name} ({new Date(show.next_episode_to_air.air_date).toLocaleDateString()})
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5 items-center">
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
              {/* Quick Rate */}
              <button type="button" onClick={() => setQuickRate(true)} className="btn-secondary">
                <Star className="w-4 h-4 text-accent-gold" /> Rate
              </button>
              {/* Watch Trailer */}
              {trailer && (
                <button type="button" onClick={() => setTrailerModal(true)} className="btn-primary">
                  <Play className="w-4 h-4 fill-current" /> Trailer
                </button>
              )}
              {/* Share */}
              <button type="button" onClick={() => setShareModal(true)} className="btn-secondary" aria-label="Share">
                <Share2 className="w-4 h-4" /> Share
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
                <img src={posterUrl} alt={show?.name ?? "Poster"} className="w-full rounded-2xl poster-shadow-lg object-cover aspect-[2/3] max-h-[500px] ring-1 ring-white/10 relative" />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 pointer-events-none" />
              </div>
            </div>

            {/* Details Column */}
            <div className="flex-1 min-w-0 flex flex-col gap-6 animate-fade-up stagger-1">
              {/* IMDb */}
              {ExternalIDs?.imdb_id && (
                <div className="flex items-center gap-2">
                  <LiaImdb className="text-xl text-accent-gold" />
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://imdb.com/title/${ExternalIDs.imdb_id}`}
                    className="text-surface-400 hover:text-accent-gold transition-colors text-sm font-medium"
                  >
                    <ImdbRating id={ExternalIDs.imdb_id} />
                  </Link>
                </div>
              )}

              {/* Overview */}
              {show?.overview && (
                <div className="card-accent rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-brand-400" />
                    <span className="text-xs font-semibold text-surface-100 uppercase tracking-wider">Overview</span>
                  </div>
                  <p className="text-sm text-surface-400 leading-relaxed">
                    {showFullOverview ? show.overview : show.overview.slice(0, 320)}
                    {show.overview.length > 320 && !showFullOverview && "…"}
                  </p>
                  {show.overview.length > 320 && (
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
                  <Tv className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-semibold text-surface-100 uppercase tracking-wider">Details</span>
                </div>
                <div className="space-y-3">
                  {firstAir && (
                    <div className="text-sm text-surface-500">
                      <span className="text-surface-400 font-medium">First air: </span>
                      {firstAir}
                      {lastAir && lastAir !== firstAir ? ` · Last air: ${lastAir}` : ""}
                    </div>
                  )}
                  {status && <div className="text-sm text-surface-500"><span className="text-surface-400 font-medium">Status: </span>{status}</div>}
                  {createdBy.length > 0 && (
                    <div className="text-sm">
                      <span className="text-surface-500 font-medium">Created by: </span>
                      {createdBy.map((c: any, i: number) => (
                        <Link
                          key={c.id}
                          href={`/app/person/${c.id}-${String(c.name).trim().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")}`}
                          className="text-surface-300 hover:text-brand-400 transition-colors"
                        >
                          {c.name}{i < createdBy.length - 1 ? ", " : ""}
                        </Link>
                      ))}
                    </div>
                  )}
                  {show?.genres?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {show.genres.map((g: any) => (
                        <Link
                          key={g.id}
                          href={`/app/tvbygenre/list/${g.id}-${g.name}`}
                          className="chip-surface"
                        >
                          {g.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {show?.production_companies?.length > 0 && (
                    <div className="text-sm text-surface-500">
                      <span className="text-surface-500">Production: </span>
                      {show.production_companies.slice(0, 5).map((c: any, i: number) => (
                        <span key={c.id}>{c.name}{i < Math.min(5, show.production_companies.length) - 1 ? ", " : ""}</span>
                      ))}
                    </div>
                  )}
                  {networks.length > 0 && (
                    <div className="text-sm text-surface-500">
                      <span className="text-surface-500">Networks: </span>
                      {networks.map((n: any, i: number) => (
                        <span key={n.id}>{n.name}{i < networks.length - 1 ? ", " : ""}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Where to Watch – moved up for prominence */}
          <div id="section-watch" className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="section-header">Where to Watch</h2>
                <p className="section-desc">Streaming, rental and purchase options</p>
              </div>
            </div>
            <WatchOptionsViewer mediaId={Number(id)} mediaType="tv" />
          </div>

          {/* Your Activity */}
          <div id="section-ratings" className="mt-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
              <div>
                <h2 className="section-header">Your Activity</h2>
                <p className="section-desc">Track episodes, rate, and review</p>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {hasWatched(id) && (
                <div className="card-accent rounded-2xl p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-surface-500 font-medium">Your list:</span>
                    <select
                      value={tvListStatus ?? "watching"}
                      onChange={async (e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setTvListStatusUpdating(true);
                        try {
                          const res = await fetch("/api/tv-list-status", {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ showId: String(id), status: v }),
                          });
                          if (res.ok) setTvListStatus(v);
                        } finally { setTvListStatusUpdating(false); }
                      }}
                      disabled={tvListStatusUpdating}
                      className="select-field !w-auto text-xs !py-1.5"
                    >
                      <option value="watching">Watching</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On hold</option>
                      <option value="dropped">Dropped</option>
                      <option value="plan_to_watch">Plan to watch</option>
                      <option value="rewatching">Rewatching</option>
                    </select>
                  </div>
                </div>
              )}
              <TvShowProgress showId={id} refreshKey={refreshProgressKey} />
              <UserRating
                itemId={id} itemType="tv" itemName={show?.name}
                imageUrl={show?.poster_path ? `https://image.tmdb.org/t/p/w92${show.poster_path}` : undefined}
                isWatched={hasWatched(id)}
              />
              <WatchedReview itemId={id} itemType="tv" isWatched={hasWatched(id)} />
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
            <FriendsWhoWatched itemId={id} itemType="tv" />
            <RatingDistribution itemId={id} itemType="tv" />
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
            <PublicReviews itemId={id} itemType="tv" />
          </div>
        </section>

        {/* Full-width sections */}
        <div className="bg-gradient-section mt-8">
          <div id="section-cast">
            <MovieCast credits={cast} id={show?.id ?? id} type="tv" />
          </div>

          {/* Seasons */}
          {seasons.length > 0 && (
            <section id="section-seasons" className="section-container section-spacing">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
                <div>
                  <h2 className="section-header">Seasons</h2>
                  <p className="section-desc">{seasons.length} season{seasons.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              {firstSeason && (
                <div className="mb-6 rounded-2xl glass-card overflow-hidden hover:border-surface-600/40 transition-all">
                  <Link
                    href={`/app/tv/${id}/season/${firstSeason.season_number}`}
                    className="flex flex-col sm:flex-row gap-5 p-5 hover:bg-surface-800/30 transition-colors"
                  >
                    <img
                      src={firstSeason.poster_path && !show?.adult ? `https://image.tmdb.org/t/p/w342${firstSeason.poster_path}` : "/no-photo.webp"}
                      alt={firstSeason.name}
                      className="rounded-xl object-cover w-full sm:w-40 aspect-video sm:aspect-2/3 ring-1 ring-white/5"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-white">{firstSeason.name}</h3>
                      <p className="text-sm text-surface-500 mt-1.5">
                        {firstSeason.air_date || "TBA"} · {firstSeason.episode_count} episodes
                      </p>
                      {firstSeason.overview && (
                        <p className="text-sm text-surface-400 mt-3 line-clamp-3 leading-relaxed">{firstSeason.overview}</p>
                      )}
                    </div>
                  </Link>
                </div>
              )}
              {otherSeasons.length > 0 && (
                <div className="relative">
                  <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 no-scrollbar pretty-scrollbar">
                    {otherSeasons.map((season: any) => (
                      <Link
                        href={`/app/tv/${id}/season/${season.season_number}`}
                        key={season.id}
                        className="shrink-0 w-36 flex flex-col gap-3 rounded-xl glass-card overflow-hidden hover:border-surface-600/50 hover:-translate-y-1 transition-all duration-300"
                      >
                        <img
                          src={season.poster_path && !show?.adult ? `https://image.tmdb.org/t/p/w185${season.poster_path}` : "/no-photo.webp"}
                          alt={season.name}
                          className="w-full aspect-2/3 object-cover"
                        />
                        <div className="p-3 pt-0">
                          <h4 className="text-sm font-semibold text-surface-100 truncate">{season.name}</h4>
                          <p className="text-xs text-surface-500 mt-0.5">{season.air_date || "TBA"}</p>
                          <p className="text-xs text-surface-500">{season.episode_count} episodes</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {canScrollLeft && (
                    <button
                      type="button"
                      onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
                      className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 glass-elevated text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all"
                      aria-label="Scroll left"
                    >
                      <FaChevronLeft size={16} />
                    </button>
                  )}
                  {canScrollRight && (
                    <button
                      type="button"
                      onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                      className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 glass-elevated text-surface-200 p-2.5 rounded-full hover:bg-surface-700 hover:text-white transition-all"
                      aria-label="Scroll right"
                    >
                      <FaChevronRight size={16} />
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

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
              <ContentAdvisory ratings={contentRatings} />
              <KeywordTags keywords={keywords} />
            </div>
          </section>
        </div>

        {/* Media */}
        <div id="section-media">
          <Video videos={videos} movie={show} />
          <ImageViewer movie={show} Bimages={Bimages} Pimages={Pimages} />
        </div>
      </div>
    </div>
  );
}
