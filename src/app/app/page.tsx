import Link from "next/link";
import DiscoverUsers from "@components/home/DiscoverUser";
import CalendarSection from "@components/home/CalendarSection";
import ContinueWatchingSection from "@components/home/ContinueWatchingSection";
import OpenAiReco from "@components/ai/openaiReco";
import CollaborativeRecs from "@components/ai/collaborativeRecs";
import WhatToWatch from "@components/home/WhatToWatch";
import CompletionPredictor from "@components/tv/CompletionPredictor";
import HomeVideo from "@components/home/videoReel";
import MovieGenre from "@components/scroll/movieGenre";
import TvGenre from "@components/scroll/tvGenre";
import HomeContentTile from "@components/movie/homeContentTile";
import BrowseTags from "@components/home/BrowseTags";
import AnimeTags from "@components/home/AnimeTags";
import FollowingFeed from "@components/feed/FollowingFeed";
import { getHomeSections } from "@/utils/homeData";
import { buildSearchUrl } from "@/utils/searchUrl";
import { ArrowRight, Film, Sparkles, Users, Calendar, Tag, Tv, Rss } from "lucide-react";

const headingBase =
  "text-xl sm:text-2xl font-bold text-white tracking-tight";

const headingLinkClass =
  "group inline-flex items-center gap-2 hover:text-brand-400 transition-colors duration-200";

const arrowIcon = "w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200";

const sectionHeader = (icon: React.ReactNode, title: string, subtitle: string) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
    <div>
      <h2 className={headingBase}>{title}</h2>
      <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
    </div>
  </div>
);

const sectionHeaderLink = (icon: React.ReactNode, title: string, subtitle: string, href: string) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
    <div>
      <h2 className={headingBase}>
        <Link href={href} className={headingLinkClass}>
          {icon}
          {title}
          <ArrowRight className={arrowIcon} />
        </Link>
      </h2>
      <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
    </div>
  </div>
);

export default async function Home() {
  const { sections, errors } = await getHomeSections();

  const movieGenres = sections.movieGenres?.genres ?? [];
  const tvGenres = sections.tvGenres?.genres ?? [];
  const weeklyTop = sections.weeklyTop?.results ?? [];
  const trendingTv = sections.trendingTv?.results ?? [];
  const animeSeries = sections.animeSeries?.results ?? [];
  const animeFilms = sections.animeFilms?.results ?? [];
  const romance = sections.romance?.results ?? [];
  const action = sections.action?.results ?? [];
  const crime = sections.crime?.results ?? [];
  const thriller = sections.thriller?.results ?? [];
  const darkZones = sections.darkZones?.results ?? [];
  const horror = sections.horror?.results ?? [];
  const bollywood = sections.bollywood?.results ?? [];

  return (
    <>
      {/* ──────── HERO ──────── */}
      <section className="w-full" aria-label="Featured">
        <HomeVideo />
      </section>

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-10 sm:gap-14">
        {errors.length > 0 && (
          <div
            className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-200 text-sm animate-fade-in"
            role="alert"
          >
            <p className="font-medium">Some sections could not load.</p>
            <p className="mt-1 text-amber-300/70 text-xs">
              You can still browse. Try refreshing in a moment.
            </p>
          </div>
        )}

        {/* ──────── PERSONAL ──────── */}
        <ContinueWatchingSection />

        {/* TV Completion Predictor */}
        <section className="animate-fade-up" aria-labelledby="predictor-heading">
          {sectionHeader(<Tv className="w-5 h-5 text-accent-purple" />, "TV Completion Forecast", "Estimated finish dates for your shows")}
          <CompletionPredictor />
        </section>

        {/* What to watch picker */}
        <section className="animate-fade-up" aria-labelledby="picker-heading">
          {sectionHeader(<Sparkles className="w-5 h-5 text-accent-purple" />, "What should I watch?", "Pick a mood, set filters, and let us decide")}
          <WhatToWatch />
        </section>

        {/* ──────── SOCIAL ──────── */}
        {/* Following Activity Feed */}
        <section className="animate-fade-up" aria-labelledby="feed-heading">
          {sectionHeader(<Rss className="w-5 h-5 text-accent-purple" />, "Following Feed", "See what people are watching, rating, and reviewing")}
          <FollowingFeed />
        </section>

        {/* For You - AI recommendations */}
        <section className="animate-fade-up stagger-1" aria-labelledby="reco-heading">
          {sectionHeaderLink(<Sparkles className="w-5 h-5 text-brand-400" />, "For You", "Based on your favorites and watched list", "/app/profile")}
          <OpenAiReco />
        </section>

        {/* Collaborative recommendations */}
        <section className="animate-fade-up stagger-2" aria-labelledby="collab-heading">
          {sectionHeader(<Users className="w-5 h-5 text-accent-purple" />, "People Like You Also Like", "Powered by collaborative filtering with similar viewers")}
          <CollaborativeRecs />
        </section>

        {/* Discover people */}
        <section className="animate-fade-up stagger-3" aria-labelledby="discover-heading">
          {sectionHeaderLink(<Users className="w-5 h-5 text-blue-400" />, "Discover People", "See what others are watching", "/app/profile")}
          <DiscoverUsers hideTitleLink />
        </section>

        {/* ──────── TRENDING ──────── */}
        {/* Weekly top 20 */}
        <section aria-labelledby="weekly-top-heading">
          {sectionHeaderLink(<Film className="w-5 h-5 text-rose-400" />, "Weekly Top 20", "Most popular right now", "/app/search/discover")}
          <HomeContentTile type="mix" data={{ results: weeklyTop }} />
        </section>

        {/* Trending TV */}
        <section aria-labelledby="trending-tv-heading">
          {sectionHeaderLink(<Tv className="w-5 h-5 text-purple-400" />, "Trending TV Shows", "Popular today", "/app/search/discover?media_type=tv")}
          <HomeContentTile type="tv" data={{ results: trendingTv }} />
        </section>

        {/* Calendar & upcoming */}
        <section className="animate-fade-up stagger-3" aria-labelledby="calendar-heading">
          {sectionHeaderLink(<Calendar className="w-5 h-5 text-amber-400" />, "Calendar & Upcoming", "In theaters and on TV this week", "/app/search/discover?media_type=movie")}
          <CalendarSection hideMainHeading />
        </section>

        {/* ──────── BROWSE ──────── */}
        {/* Browse by tag */}
        <section aria-labelledby="browse-tags-heading">
          {sectionHeaderLink(<Tag className="w-5 h-5 text-cyan-400" />, "Browse by Tag", "Genres, keywords and categories", "/app/search")}
          <BrowseTags />
        </section>

        {/* Anime sections */}
        <section aria-labelledby="anime-browse-heading">
          {sectionHeaderLink(null, "Browse Anime", "Series, films, Isekai and more", buildSearchUrl({ query: "discover", mediaType: "tv", keyword: "210024" }))}
          <AnimeTags />
        </section>

        {/* Anime series */}
        <section aria-labelledby="anime-series-heading">
          {sectionHeaderLink(null, "Anime Series", "Jujutsu Kaisen, SPY×FAMILY, One Piece & more", "/app/tvbygenre/list/16-Animation")}
          <HomeContentTile type="tv" data={{ results: animeSeries }} />
        </section>

        {/* Anime films */}
        <section aria-labelledby="anime-films-heading">
          {sectionHeaderLink(null, "Anime Films", "Studio Ghibli, Makoto Shinkai and Japanese animated movies", buildSearchUrl({ query: "discover", mediaType: "movie", genre: "16", language: "ja" }))}
          <HomeContentTile type="movie" data={{ results: animeFilms }} />
        </section>

        {/* ──────── CURATED COLLECTIONS ──────── */}
        {/* Romance */}
        <section aria-labelledby="romance-heading">
          {sectionHeaderLink(null, "Romance & Love", "Love stories and feel-good picks", "/app/moviebygenre/list/10749-Romance")}
          <HomeContentTile type="movie" data={{ results: romance }} />
        </section>

        {/* Action */}
        <section aria-labelledby="action-heading">
          {sectionHeaderLink(null, "Action", "Thrills and blockbusters", "/app/moviebygenre/list/28-Action")}
          <HomeContentTile type="movie" data={{ results: action }} />
        </section>

        {/* Crime */}
        <section aria-labelledby="crime-heading">
          {sectionHeaderLink(null, "Crime", "Heists, detectives and the underworld", "/app/moviebygenre/list/80-Crime")}
          <HomeContentTile type="movie" data={{ results: crime }} />
        </section>

        {/* Thriller */}
        <section aria-labelledby="thrills-heading">
          {sectionHeaderLink(null, "Thrills", "Edge-of-your-seat tension and suspense", "/app/moviebygenre/list/53-Thriller")}
          <HomeContentTile type="movie" data={{ results: thriller }} />
        </section>

        {/* Dark zones */}
        <section aria-labelledby="dark-zones-heading">
          {sectionHeaderLink(null, "Dark Zones", "Horror and the darker side of cinema", "/app/moviebygenre/list/27-Horror")}
          <HomeContentTile type="movie" data={{ results: darkZones }} />
        </section>

        {/* Horror */}
        <section aria-labelledby="horror-heading">
          {sectionHeaderLink(null, "Horror", "Scares, suspense and the supernatural", "/app/moviebygenre/list/27-Horror")}
          <HomeContentTile type="movie" data={{ results: horror }} />
        </section>

        {/* Bollywood */}
        <section aria-labelledby="bollywood-heading">
          {sectionHeaderLink(null, "Bollywood", "Hindi cinema picks", "/app/search/discover?media_type=movie&lang=hi")}
          <HomeContentTile type="movie" data={{ results: bollywood }} />
        </section>

        {/* ──────── GENRE BROWSER ──────── */}
        {/* Movie genres */}
        <section aria-labelledby="movie-genres-heading">
          {sectionHeaderLink(<Film className="w-5 h-5 text-surface-400" />, "Movie Genres", "Browse by genre", "/app/search/discover?media_type=movie")}
          <MovieGenre genre={movieGenres} />
        </section>

        {/* TV genres */}
        <section aria-labelledby="tv-genres-heading">
          {sectionHeaderLink(<Tv className="w-5 h-5 text-surface-400" />, "TV Show Genres", "Browse TV by genre", "/app/search/discover?media_type=tv")}
          <TvGenre tvGenres={tvGenres} />
        </section>
      </div>
    </>
  );
}
