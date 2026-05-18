import Link from "next/link";
import DiscoverUsers from "@components/home/DiscoverUser";
import CalendarSection from "@components/home/CalendarSection";
import ContinueWatchingSection from "@components/home/ContinueWatchingSection";
import OpenAiReco from "@components/ai/openaiReco";
import HomeVideo from "@components/home/videoReel";
import MovieGenre from "@components/scroll/movieGenre";
import TvGenre from "@components/scroll/tvGenre";
import HomeContentTile from "@components/movie/homeContentTile";
import BrowseTags from "@components/home/BrowseTags";
import AnimeTags from "@components/home/AnimeTags";
import { getHomeSections } from "@/utils/homeData";
import { buildSearchUrl } from "@/utils/searchUrl";
import { ArrowRight, Film, Sparkles, Users, Calendar, Tag, Tv } from "lucide-react";

const headingBase =
  "text-xl sm:text-2xl font-bold text-white tracking-tight";

const headingLinkClass =
  "group inline-flex items-center gap-2 hover:text-brand-400 transition-colors duration-200";

const arrowIcon = "w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200";

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
      {/* Hero */}
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

        {/* Continue watching */}
        <ContinueWatchingSection />

        {/* Personal recommendations */}
        <section className="animate-fade-up stagger-1" aria-labelledby="reco-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="reco-heading" className={headingBase}>
                <Link href="/app/profile" className={headingLinkClass}>
                  <Sparkles className="w-5 h-5 text-brand-400" />
                  For You
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Based on your favorites and watched list
              </p>
            </div>
          </div>
          <OpenAiReco />
        </section>

        {/* Discover people */}
        <section className="animate-fade-up stagger-2" aria-labelledby="discover-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="discover-heading" className={headingBase}>
                <Link href="/app/profile" className={headingLinkClass}>
                  <Users className="w-5 h-5 text-blue-400" />
                  Discover People
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                See what others are watching
              </p>
            </div>
          </div>
          <DiscoverUsers hideTitleLink />
        </section>

        {/* Calendar & upcoming */}
        <section className="animate-fade-up stagger-3" aria-labelledby="calendar-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="calendar-heading" className={headingBase}>
                <Link
                  href="/app/search/discover?media_type=movie"
                  className={headingLinkClass}
                >
                  <Calendar className="w-5 h-5 text-amber-400" />
                  Calendar & Upcoming
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                In theaters and on TV this week
              </p>
            </div>
          </div>
          <CalendarSection hideMainHeading />
        </section>

        {/* Weekly top 20 */}
        <section aria-labelledby="weekly-top-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="weekly-top-heading" className={headingBase}>
                <Link href="/app/search/discover" className={headingLinkClass}>
                  <Film className="w-5 h-5 text-rose-400" />
                  Weekly Top 20
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Most popular right now
              </p>
            </div>
          </div>
          <HomeContentTile type="mix" data={{ results: weeklyTop }} />
        </section>

        {/* Trending TV */}
        <section aria-labelledby="trending-tv-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="trending-tv-heading" className={headingBase}>
                <Link
                  href="/app/search/discover?media_type=tv"
                  className={headingLinkClass}
                >
                  <Tv className="w-5 h-5 text-purple-400" />
                  Trending TV Shows
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">Popular today</p>
            </div>
          </div>
          <HomeContentTile type="tv" data={{ results: trendingTv }} />
        </section>

        {/* Browse by tag */}
        <section aria-labelledby="browse-tags-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="browse-tags-heading" className={headingBase}>
                <Link href="/app/search" className={headingLinkClass}>
                  <Tag className="w-5 h-5 text-cyan-400" />
                  Browse by Tag
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Genres, keywords and categories
              </p>
            </div>
          </div>
          <BrowseTags />
        </section>

        {/* Anime sections */}
        <section aria-labelledby="anime-browse-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="anime-browse-heading" className={headingBase}>
                <Link
                  href={buildSearchUrl({
                    query: "discover",
                    mediaType: "tv",
                    keyword: "210024",
                  })}
                  className={headingLinkClass}
                >
                  Browse Anime
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Series, films, Isekai and more
              </p>
            </div>
          </div>
          <AnimeTags />
        </section>

        {/* Anime series */}
        <section aria-labelledby="anime-series-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="anime-series-heading" className={headingBase}>
                <Link
                  href="/app/tvbygenre/list/16-Animation"
                  className={headingLinkClass}
                >
                  Anime Series
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Jujutsu Kaisen, SPY×FAMILY, One Piece & more
              </p>
            </div>
          </div>
          <HomeContentTile type="tv" data={{ results: animeSeries }} />
        </section>

        {/* Anime films */}
        <section aria-labelledby="anime-films-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="anime-films-heading" className={headingBase}>
                <Link
                  href={buildSearchUrl({
                    query: "discover",
                    mediaType: "movie",
                    genre: "16",
                    language: "ja",
                  })}
                  className={headingLinkClass}
                >
                  Anime Films
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Studio Ghibli, Makoto Shinkai and Japanese animated movies
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: animeFilms }} />
        </section>

        {/* Romance */}
        <section aria-labelledby="romance-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="romance-heading" className={headingBase}>
                <Link
                  href="/app/moviebygenre/list/10749-Romance"
                  className={headingLinkClass}
                >
                  Romance & Love
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Love stories and feel-good picks
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: romance }} />
        </section>

        {/* Action */}
        <section aria-labelledby="action-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="action-heading" className={headingBase}>
                <Link
                  href="/app/moviebygenre/list/28-Action"
                  className={headingLinkClass}
                >
                  Action
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Thrills and blockbusters
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: action }} />
        </section>

        {/* Crime */}
        <section aria-labelledby="crime-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="crime-heading" className={headingBase}>
                <Link
                  href="/app/moviebygenre/list/80-Crime"
                  className={headingLinkClass}
                >
                  Crime
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Heists, detectives and the underworld
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: crime }} />
        </section>

        {/* Thriller */}
        <section aria-labelledby="thrills-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="thrills-heading" className={headingBase}>
                <Link
                  href="/app/moviebygenre/list/53-Thriller"
                  className={headingLinkClass}
                >
                  Thrills
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Edge-of-your-seat tension and suspense
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: thriller }} />
        </section>

        {/* Dark zones */}
        <section aria-labelledby="dark-zones-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="dark-zones-heading" className={headingBase}>
                <Link
                  href="/app/moviebygenre/list/27-Horror"
                  className={headingLinkClass}
                >
                  Dark Zones
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Horror and the darker side of cinema
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: darkZones }} />
        </section>

        {/* Horror */}
        <section aria-labelledby="horror-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="horror-heading" className={headingBase}>
                <Link
                  href="/app/moviebygenre/list/27-Horror"
                  className={headingLinkClass}
                >
                  Horror
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Scares, suspense and the supernatural
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: horror }} />
        </section>

        {/* Bollywood */}
        <section aria-labelledby="bollywood-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="bollywood-heading" className={headingBase}>
                <Link
                  href="/app/search/discover?media_type=movie&lang=hi"
                  className={headingLinkClass}
                >
                  Bollywood
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Hindi cinema picks
              </p>
            </div>
          </div>
          <HomeContentTile type="movie" data={{ results: bollywood }} />
        </section>

        {/* Movie genres */}
        <section aria-labelledby="movie-genres-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="movie-genres-heading" className={headingBase}>
                <Link
                  href="/app/search/discover?media_type=movie"
                  className={headingLinkClass}
                >
                  Movie Genres
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">Browse by genre</p>
            </div>
          </div>
          <MovieGenre genre={movieGenres} />
        </section>

        {/* TV genres */}
        <section aria-labelledby="tv-genres-heading">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 id="tv-genres-heading" className={headingBase}>
                <Link
                  href="/app/search/discover?media_type=tv"
                  className={headingLinkClass}
                >
                  TV Show Genres
                  <ArrowRight className={arrowIcon} />
                </Link>
              </h2>
              <p className="text-sm text-surface-500 mt-1">
                Browse TV by genre
              </p>
            </div>
          </div>
          <TvGenre tvGenres={tvGenres} />
        </section>
      </div>
    </>
  );
}
