import Link from "@components/ui/AppLink";
import type { Metadata } from "next";
import { getHomeContent } from "@/utils/homeData";
import { SignedIn, SignedOut } from "@components/home/AuthGate";
import HomeGreeting from "@components/home/HomeGreeting";
import HomeHero from "@components/home/HomeHero";
import QuickActions from "@components/home/QuickActions";
import TrendingNow from "@components/home/TrendingNow";
import GenreExplorer from "@components/home/GenreExplorer";
import UserSidebar from "@components/home/UserSidebar";
import ContinueWatchingProgress from "@components/tv/ContinueWatchingProgress";
import FollowingFeed from "@components/feed/FollowingFeed";
import AiringSoon from "@components/home/AiringSoon";
import PeopleYouMayKnow from "@components/home/PeopleYouMayKnow";
import PopularReviews from "@components/home/PopularReviews";
import { Film, TrendingUp, Compass, MessageCircle, Play } from "lucide-react";

/**
 * Home is five sections, and that is the point.
 *
 * It used to carry nine genre carousels, a leaderboard, two separate
 * people-you-might-like modules and two different "what should I watch"
 * widgets — twenty-five surfaces competing for the same attention, none of
 * which answered the question people actually open the app with. Everything
 * that was browsing rather than deciding moved behind GenreExplorer and
 * /app/profile, which already did the same job better.
 *
 * What's left: decide (Tonight), resume (Continue watching), what your people
 * are doing (Feed), what's live (Trending), and one way out to browse.
 */

/**
 * On the page, deliberately not on the layout.
 *
 * `/app` is the sitemap's second-highest priority URL and had no title of its
 * own — the landing page and the logged-in home read identically to a crawler.
 * The obvious fix is a layout, and it is a trap: `alternates.canonical` is
 * inherited, and thirteen routes under `/app` set none of their own. Every one
 * of them — including `/app/review/[id]`, which carries Review JSON-LD — would
 * have started announcing `/app` as its canonical, which is a request to be
 * de-indexed as a duplicate. A page's metadata is inherited by nothing.
 */
export const metadata: Metadata = {
  title: "Home",
  description:
    "What the people you follow are watching, what is out this week, and what you left half-finished.",
  alternates: { canonical: "/app" },
};

/**
 * One render an hour, for everybody, instead of one render per visit.
 *
 * This page used to read the session to decide between a greeting and a sign-up
 * card, which made it `ƒ` — a full server render on every load of the page every
 * signed-in session starts on. The branch now happens in the browser (see
 * `AuthGate`), nothing in this tree reads a cookie, and the hour matches
 * `getHomeContent`'s own TMDB revalidate so the page and its data go stale
 * together rather than one waiting on the other.
 */
export const revalidate = 3600;

export default async function Home() {
  const { content, errors } = await getHomeContent();

  return (
    <>
      {/* ═══════ HERO BANNER ═══════ */}
      <HomeHero items={content.trending} />

      <div className="w-full bg-surface-950">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">

          {/* Greeting */}
          <HomeGreeting />

          {/* Main layout: sidebar (personal) + feed */}
          <div className="flex flex-col lg:flex-row gap-8 mt-6">
            {/* ═══════ SIDEBAR ═══════ */}
            <aside className="lg:w-[340px] lg:shrink-0 order-2 lg:order-1 space-y-6">
              <SignedIn>
                <UserSidebar />
                <AiringSoon />
              </SignedIn>
              <SignedOut>
                <div className="rounded-2xl border border-brand-500/10 bg-gradient-to-br from-brand-500/5 to-surface-900/50 p-6 text-center">
                  <Film className="size-8 text-brand-400 mx-auto mb-3" />
                  <h2 className="text-white font-semibold mb-2">Join the community</h2>
                  <p className="text-surface-400 text-sm mb-4">Track what you watch, write reviews, and discover with friends.</p>
                  <Link href="/signup" className="btn-primary text-sm w-full justify-center py-2.5">
                    Get started — it’s free
                  </Link>
                  <p className="text-surface-600 text-xs mt-3">
                    Already have an account? <Link href="/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
                  </p>
                </div>
              </SignedOut>

              {/* Quick actions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Compass className="size-4 text-surface-500" />
                  <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-[0.2em]">Explore</h2>
                </div>
                <QuickActions />
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3 text-amber-300/80 text-xs">
                  Some sections couldn’t load. Refresh to try again.
                </div>
              )}

              {/* One taste row, not two. PeopleYouMayKnow leads with the
                  shared-title evidence; the old counter-card grid duplicated
                  it with weaker signal and /app/profile already does browsing
                  properly. */}
              <SignedIn><PeopleYouMayKnow /></SignedIn>
            </aside>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <main className="flex-1 min-w-0 order-1 lg:order-2 space-y-10">
              {/* What you're already part-way through, above everything else
                  you might start. This sat in the sidebar under the profile
                  stats card, which put it 1,167px down a 900px viewport — it
                  rendered correctly and essentially nobody would ever see it.
                  Tonight answers "what shall I start"; this answers "what was
                  I already watching", and the second question is the commoner
                  one for someone coming back. */}
              <SignedIn><ContinueWatchingProgress /></SignedIn>

              {/* Tonight — the only thing here that happens *before* watching,
                  so it sits above everything that happens after. */}
              <SignedIn>
                <section>
                  <Link
                    href="/app/tonight"
                    className="group flex items-center gap-4 rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 to-surface-900/40 p-5 sm:p-6 hover:border-brand-500/40 transition-colors"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-500/15">
                      <Play className="size-5 text-brand-400" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-bold text-white">
                        What are we watching tonight?
                      </span>
                      <span className="block text-sm text-surface-400 mt-0.5">
                        Who&apos;s in, how long you&apos;ve got, what you can stream — one answer.
                      </span>
                    </span>
                    <span className="ml-auto hidden sm:block text-surface-600 group-hover:text-brand-400 transition-colors">
                      →
                    </span>
                  </Link>
                </section>
              </SignedIn>

              {/* Following Feed */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="size-4 text-brand-400" />
                    <h2 className="text-lg font-bold text-white">What people are saying</h2>
                  </div>
                </div>
                <FollowingFeed />
              </section>

              {/* Worth reading. Renders nothing when there's nothing to
                  show, so it costs the page no height until the community
                  produces something — but it's the reason writing a review
                  here has any distribution at all. */}
              <PopularReviews />

              {/* Trending Now */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="size-4 text-brand-400" />
                    <h2 className="text-lg font-bold text-white">Trending Now</h2>
                  </div>
                  <Link href="/app/search?sort=trending" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                    View all <span className="text-surface-600">→</span>
                  </Link>
                </div>
                <TrendingNow items={content.trending} trendingTv={content.trendingTv} />
              </section>

              {/* Genre Explorer — the way out to everything the nine carousels
                  used to preload. */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-blue-400" />
                    <h2 className="text-lg font-bold text-white">Browse by Genre</h2>
                  </div>
                </div>
                <GenreExplorer movieGenres={content.movieGenres} tvGenres={content.tvGenres} />
              </section>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}
