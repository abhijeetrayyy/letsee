// import SearchForm from "@/components/homeDiscover/client/seachForm";
import Link from "next/link";
import DiscoverUsers from "@components/home/DiscoverUser";
import CalendarSection from "@components/home/CalendarSection";
import ContinueWatchingSection from "@components/home/ContinueWatchingSection";
import CurrentlyWatchingSection from "@components/home/CurrentlyWatchingSection";
import OpenAiReco from "@components/ai/openaiReco";
import HomeVideo from "@components/home/videoReel";
import MovieGenre from "@components/scroll/movieGenre";
import TvGenre from "@components/scroll/tvGenre";
import HomeContentTile from "@components/movie/homeContentTile";
import { getHomeSections } from "@/utils/homeData";

const SECTION_HEADING =
  "text-2xl sm:text-3xl font-bold text-white tracking-tight mb-5";
const SECTION_SUB = "text-sm sm:text-base text-neutral-400 mt-1 mb-6";

const headingLinkClass =
  "hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900 rounded";

export default async function Home() {
  const { sections, errors } = await getHomeSections();

  const movieGenres = sections.movieGenres?.genres ?? [];
  const tvGenres = sections.tvGenres?.genres ?? [];
  const weeklyTop = sections.weeklyTop?.results ?? [];
  const trendingTv = sections.trendingTv?.results ?? [];
  const romance = sections.romance?.results ?? [];
  const action = sections.action?.results ?? [];
  const crime = sections.crime?.results ?? [];
  const thriller = sections.thriller?.results ?? [];
  const darkZones = sections.darkZones?.results ?? [];
  const horror = sections.horror?.results ?? [];
  const bollywood = sections.bollywood?.results ?? [];

  return (
    <>
      {/* Hero: Romance & emotion — video or poster, auto-rotates */}
      <section className="w-full" aria-label="Romance and emotion">
        <HomeVideo />
      </section>

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-14 sm:gap-16">
        {errors.length > 0 && (
          <div
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm"
            role="alert"
          >
            <p className="font-semibold">Some data could not be loaded.</p>
            <p className="mt-1 text-amber-200/90">
              You can still browse. Try refreshing in a moment.
            </p>
          </div>
        )}

        {/* Continue watching (TV episode progress) — client, only shows when user has episode progress */}
        <ContinueWatchingSection />

        {/* Currently watching — movies & TV shows marked as "watching" */}
        <CurrentlyWatchingSection />

        {/* Personal recommendations (TMDB genre-based) */}
        <section
          className="rounded-2xl border border-neutral-700/60 bg-neutral-800/50 px-4 sm:px-6 py-8 sm:py-10"
          aria-labelledby="reco-heading"
        >
          <h2 id="reco-heading" className={SECTION_HEADING}>
            <Link href="/app/profile" className={headingLinkClass}>
              Your personal recommendations
            </Link>
          </h2>
          <p className={SECTION_SUB}>
            Based on your favorites and watched list — genre-based picks from
            TMDB
          </p>
          <OpenAiReco />
        </section>

        {/* Search — commented out for now */}
        {/* <section
          className="rounded-2xl border border-neutral-700/50 bg-neutral-800/40 px-4 sm:px-6 py-6 sm:py-8"
          aria-labelledby="search-heading"
        >
          <h2 id="search-heading" className={SECTION_HEADING}>
            Search
          </h2>
          <p className={SECTION_SUB}>
            Find movies, TV shows, or people
          </p>
          <SearchForm />
        </section> */}

        {/* Discover people */}
        <section
          className="rounded-2xl border border-neutral-700/60 bg-neutral-800/40 px-4 sm:px-6 py-8 sm:py-10"
          aria-labelledby="discover-heading"
        >
          <h2 id="discover-heading" className={SECTION_HEADING}>
            <Link href="/app/profile" className={headingLinkClass}>
              Discover people
            </Link>
          </h2>
          <p className={SECTION_SUB}>
            See what others are watching and add them to your feed
          </p>
          <DiscoverUsers hideTitleLink />
        </section>

        {/* Calendar & upcoming */}
        <section aria-labelledby="calendar-heading">
          <h2 id="calendar-heading" className={SECTION_HEADING}>
            <Link
              href="/app/search/discover?media_type=movie"
              className={headingLinkClass}
            >
              Calendar &amp; upcoming
            </Link>
          </h2>
          <p className={SECTION_SUB}>In theaters and on TV this week</p>
          <CalendarSection hideMainHeading />
        </section>

        {/* Romance — first content row, matches hero vibe */}
        <section aria-labelledby="romance-heading">
          <h2 id="romance-heading" className={SECTION_HEADING}>
            <Link
              href="/app/moviebygenre/list/10749-Romance"
              className={headingLinkClass}
            >
              Romance &amp; love
            </Link>
          </h2>
          <p className={SECTION_SUB}>Love stories and feel-good picks</p>
          <HomeContentTile type="movie" data={{ results: romance }} />
        </section>

        {/* Weekly top 20 */}
        <section aria-labelledby="weekly-top-heading">
          <h2 id="weekly-top-heading" className={SECTION_HEADING}>
            <Link href="/app/search/discover" className={headingLinkClass}>
              Weekly top 20
            </Link>
          </h2>
          <p className={SECTION_SUB}>Most popular movies and shows right now</p>
          <HomeContentTile type="mix" data={{ results: weeklyTop }} />
        </section>

        {/* Trending TV */}
        <section aria-labelledby="trending-tv-heading">
          <h2 id="trending-tv-heading" className={SECTION_HEADING}>
            <Link
              href="/app/search/discover?media_type=tv"
              className={headingLinkClass}
            >
              Trending TV shows
            </Link>
          </h2>
          <p className={SECTION_SUB}>Popular today</p>
          <HomeContentTile type="tv" data={{ results: trendingTv }} />
        </section>

        {/* Action */}
        <section aria-labelledby="action-heading">
          <h2 id="action-heading" className={SECTION_HEADING}>
            <Link
              href="/app/moviebygenre/list/28-Action"
              className={headingLinkClass}
            >
              Action
            </Link>
          </h2>
          <p className={SECTION_SUB}>Thrills and blockbusters</p>
          <HomeContentTile type="movie" data={{ results: action }} />
        </section>

        {/* Crime */}
        <section aria-labelledby="crime-heading">
          <h2 id="crime-heading" className={SECTION_HEADING}>
            <Link
              href="/app/moviebygenre/list/80-Crime"
              className={headingLinkClass}
            >
              Crime
            </Link>
          </h2>
          <p className={SECTION_SUB}>Heists, detectives and the underworld</p>
          <HomeContentTile type="movie" data={{ results: crime }} />
        </section>

        {/* Thrills (Thriller) */}
        <section aria-labelledby="thrills-heading">
          <h2 id="thrills-heading" className={SECTION_HEADING}>
            <Link
              href="/app/moviebygenre/list/53-Thriller"
              className={headingLinkClass}
            >
              Thrills
            </Link>
          </h2>
          <p className={SECTION_SUB}>Edge-of-your-seat tension and suspense</p>
          <HomeContentTile type="movie" data={{ results: thriller }} />
        </section>

        {/* Dark zones (Horror) */}
        <section aria-labelledby="dark-zones-heading">
          <h2 id="dark-zones-heading" className={SECTION_HEADING}>
            <Link
              href="/app/moviebygenre/list/27-Horror"
              className={headingLinkClass}
            >
              Dark zones
            </Link>
          </h2>
          <p className={SECTION_SUB}>Horror and the darker side of cinema</p>
          <HomeContentTile type="movie" data={{ results: darkZones }} />
        </section>

        {/* Horror */}
        <section aria-labelledby="horror-heading">
          <h2 id="horror-heading" className={SECTION_HEADING}>
            <Link
              href="/app/moviebygenre/list/27-Horror"
              className={headingLinkClass}
            >
              Horror
            </Link>
          </h2>
          <p className={SECTION_SUB}>Scares, suspense and the supernatural</p>
          <HomeContentTile type="movie" data={{ results: horror }} />
        </section>

        {/* Bollywood */}
        <section aria-labelledby="bollywood-heading">
          <h2 id="bollywood-heading" className={SECTION_HEADING}>
            <Link
              href="/app/search/discover?media_type=movie&lang=hi"
              className={headingLinkClass}
            >
              Bollywood
            </Link>
          </h2>
          <p className={SECTION_SUB}>Hindi cinema picks</p>
          <HomeContentTile type="movie" data={{ results: bollywood }} />
        </section>

        {/* Movie genres */}
        <section aria-labelledby="movie-genres-heading">
          <h2 id="movie-genres-heading" className={SECTION_HEADING}>
            <Link
              href="/app/search/discover?media_type=movie"
              className={headingLinkClass}
            >
              Movie genres
            </Link>
          </h2>
          <p className={SECTION_SUB}>Browse by genre</p>
          <MovieGenre genre={movieGenres} />
        </section>

        {/* TV genres */}
        <section aria-labelledby="tv-genres-heading">
          <h2 id="tv-genres-heading" className={SECTION_HEADING}>
            <Link
              href="/app/search/discover?media_type=tv"
              className={headingLinkClass}
            >
              TV show genres
            </Link>
          </h2>
          <p className={SECTION_SUB}>Browse TV by genre</p>
          <TvGenre tvGenres={tvGenres} />
        </section>
      </div>
    </>
  );
}
