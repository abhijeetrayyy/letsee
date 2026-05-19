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
import { ArrowRight, Film, Sparkles, Users, Calendar, Tag, Tv, Rss, Search, BookOpen, Heart } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

const headingBase =
  "text-xl sm:text-2xl font-bold text-white tracking-tight";

const headingLinkClass =
  "group inline-flex items-center gap-2 hover:text-brand-400 transition-colors duration-200";

const arrowIcon = "w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200";

const sectionHeader = (title: string, subtitle: string) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
    <div>
      <h2 className={headingBase}>{title}</h2>
      <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
    </div>
  </div>
);

const sectionHeaderLink = (title: string, subtitle: string, href: string) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
    <div>
      <h2 className={headingBase}>
        <Link href={href} className={headingLinkClass}>
          {title}
          <ArrowRight className={arrowIcon} />
        </Link>
      </h2>
      <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
    </div>
  </div>
);

async function getUsername() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("id", user.id)
      .single();
    return data?.username ?? null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const { sections, errors } = await getHomeSections();
  const username = await getUsername();

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

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

        {/* ──────── GREETING + QUICK ACTIONS ──────── */}
        <div className="animate-fade-up">
          {username && (
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              {greeting}, <span className="text-gradient-brand">{username}</span>
            </h1>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href="/app/search" className="btn-secondary text-sm">
              <Search className="w-4 h-4" />
              Search
            </Link>
            <Link href="/app/watchlist" className="btn-secondary text-sm">
              <Heart className="w-4 h-4" />
              Watchlist
            </Link>
            <Link href="/app/profile" className="btn-secondary text-sm">
              <BookOpen className="w-4 h-4" />
              My Diary
            </Link>
          </div>
        </div>

        {/* ──────── PERSONAL ──────── */}
        <ContinueWatchingSection />

        {/* TV Completion Predictor */}
        <section className="animate-fade-up" aria-labelledby="predictor-heading">
          {sectionHeader("TV Completion Forecast", "Estimated finish dates for your shows")}
          <CompletionPredictor />
        </section>

        {/* What to watch picker */}
        <section className="animate-fade-up" aria-labelledby="picker-heading">
          {sectionHeader("What should I watch?", "Pick a mood, set filters, and let us decide")}
          <WhatToWatch />
        </section>

        {/* ──────── SOCIAL ──────── */}
        <section className="animate-fade-up" aria-labelledby="feed-heading">
          {sectionHeader("Following Feed", "See what people are watching, rating, and reviewing")}
          <FollowingFeed />
        </section>

        <section className="animate-fade-up stagger-1" aria-labelledby="reco-heading">
          {sectionHeaderLink("For You", "Based on your favorites and watched list", "/app/profile")}
          <OpenAiReco />
        </section>

        <section className="animate-fade-up stagger-2" aria-labelledby="collab-heading">
          {sectionHeader("People Like You Also Like", "Powered by collaborative filtering with similar viewers")}
          <CollaborativeRecs />
        </section>

        <section className="animate-fade-up stagger-3" aria-labelledby="discover-heading">
          {sectionHeaderLink("Discover People", "See what others are watching", "/app/profile")}
          <DiscoverUsers hideTitleLink />
        </section>

        {/* ──────── TRENDING ──────── */}
        <section aria-labelledby="weekly-top-heading">
          {sectionHeaderLink("Weekly Top 20", "Most popular right now", "/app/search/discover")}
          <HomeContentTile type="mix" data={{ results: weeklyTop }} />
        </section>

        <section aria-labelledby="trending-tv-heading">
          {sectionHeaderLink("Trending TV Shows", "Popular today", "/app/search/discover?media_type=tv")}
          <HomeContentTile type="tv" data={{ results: trendingTv }} />
        </section>

        <section className="animate-fade-up stagger-3" aria-labelledby="calendar-heading">
          {sectionHeaderLink("Calendar & Upcoming", "In theaters and on TV this week", "/app/search/discover?media_type=movie")}
          <CalendarSection hideMainHeading />
        </section>

        {/* ──────── BROWSE ──────── */}
        <section aria-labelledby="browse-tags-heading">
          {sectionHeaderLink("Browse by Tag", "Genres, keywords and categories", "/app/search")}
          <BrowseTags />
        </section>

        {/* ──────── ANIME ──────── */}
        <section aria-labelledby="anime-heading">
          {sectionHeaderLink("Anime", "Series, films, Isekai and more", buildSearchUrl({ query: "discover", mediaType: "tv", keyword: "210024" }))}
          <div className="space-y-6">
            <AnimeTags />
            {animeSeries.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Popular Series</h3>
                <HomeContentTile type="tv" data={{ results: animeSeries }} />
              </div>
            )}
            {animeFilms.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Popular Films</h3>
                <HomeContentTile type="movie" data={{ results: animeFilms }} />
              </div>
            )}
          </div>
        </section>

        {/* ──────── CURATED COLLECTIONS ──────── */}
        <section aria-labelledby="collections-heading">
          {sectionHeader("Curated Collections", "Handpicked genres and themes")}
          <div className="space-y-8">
            {romance.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Romance & Love</h3>
                <HomeContentTile type="movie" data={{ results: romance }} />
              </div>
            )}
            {action.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Action</h3>
                <HomeContentTile type="movie" data={{ results: action }} />
              </div>
            )}
            {crime.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Crime</h3>
                <HomeContentTile type="movie" data={{ results: crime }} />
              </div>
            )}
            {thriller.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Thrills</h3>
                <HomeContentTile type="movie" data={{ results: thriller }} />
              </div>
            )}
            {horror.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Horror</h3>
                <HomeContentTile type="movie" data={{ results: horror }} />
              </div>
            )}
            {bollywood.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-surface-300 mb-3 uppercase tracking-wider">Bollywood</h3>
                <HomeContentTile type="movie" data={{ results: bollywood }} />
              </div>
            )}
          </div>
        </section>

        {/* ──────── GENRE BROWSER ──────── */}
        <section aria-labelledby="movie-genres-heading">
          {sectionHeaderLink("Movie Genres", "Browse by genre", "/app/search/discover?media_type=movie")}
          <MovieGenre genre={movieGenres} />
        </section>

        <section aria-labelledby="tv-genres-heading">
          {sectionHeaderLink("TV Show Genres", "Browse TV by genre", "/app/search/discover?media_type=tv")}
          <TvGenre tvGenres={tvGenres} />
        </section>
      </div>
    </>
  );
}
