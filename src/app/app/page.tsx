import Link from "next/link";
import { getHomeContent } from "@/utils/homeData";
import { createClient } from "@/utils/supabase/server";
import HomeHero from "@components/home/HomeHero";
import QuickActions from "@components/home/QuickActions";
import TrendingNow from "@components/home/TrendingNow";
import GenreExplorer from "@components/home/GenreExplorer";
import UserSidebar from "@components/home/UserSidebar";
import ContinueWatchingProgress from "@components/tv/ContinueWatchingProgress";
import FollowingFeed from "@components/feed/FollowingFeed";
import AiringSoon from "@components/home/AiringSoon";
import PeopleYouMayKnow from "@components/home/PeopleYouMayKnow";
import { Film, TrendingUp, Compass, Flame, Play } from "lucide-react";

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

async function getUsername(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("users").select("username").eq("id", user.id).single();
    return data?.username ?? null;
  } catch { return null; }
}

export default async function Home() {
  const [{ content, errors }, username] = await Promise.all([
    getHomeContent(),
    getUsername(),
  ]);
  const isLoggedIn = !!username;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  return (
    <>
      {/* ═══════ HERO BANNER ═══════ */}
      <HomeHero items={content.trending} />

      <div className="w-full bg-surface-950">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">

          {/* Greeting */}
          {isLoggedIn && (
            <div className="pt-6 pb-2">
              <h1 className="text-lg sm:text-xl font-medium text-surface-300">
                Good {greeting}, <span className="text-white font-semibold">{username}</span>
              </h1>
            </div>
          )}

          {/* Main layout: sidebar (personal) + feed */}
          <div className="flex flex-col lg:flex-row gap-8 mt-6">
            {/* ═══════ SIDEBAR ═══════ */}
            <aside className="lg:w-[340px] lg:shrink-0 order-2 lg:order-1 space-y-6">
              {isLoggedIn ? (
                <>
                  <UserSidebar username={username!} />
                  {/* The heading lives inside the component — rendering it out
                      here left a floating "CONTINUE" label above nothing
                      whenever there was no progress to show. */}
                  <ContinueWatchingProgress />
                  <AiringSoon />
                </>
              ) : (
                <div className="rounded-2xl border border-brand-500/10 bg-gradient-to-br from-brand-500/5 to-surface-900/50 p-6 text-center">
                  <Film className="size-8 text-brand-400 mx-auto mb-3" />
                  <h2 className="text-white font-semibold mb-2">Join the community</h2>
                  <p className="text-surface-400 text-sm mb-4">Track what you watch, write reviews, and discover with friends.</p>
                  <Link href="/signup" className="btn-primary text-sm w-full justify-center py-2.5">
                    Get started — it's free
                  </Link>
                  <p className="text-surface-600 text-xs mt-3">
                    Already have an account? <Link href="/login" className="text-brand-400 hover:text-brand-300">Sign in</Link>
                  </p>
                </div>
              )}

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
                  Some sections couldn't load. Refresh to try again.
                </div>
              )}

              {/* One taste row, not two. PeopleYouMayKnow leads with the
                  shared-title evidence; the old counter-card grid duplicated
                  it with weaker signal and /app/profile already does browsing
                  properly. */}
              {isLoggedIn && <PeopleYouMayKnow />}
            </aside>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <main className="flex-1 min-w-0 order-1 lg:order-2 space-y-10">
              {/* Tonight — the only thing here that happens *before* watching,
                  so it sits above everything that happens after. */}
              {isLoggedIn && (
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
              )}

              {/* Following Feed */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="size-4 text-amber-400" />
                    <h2 className="text-lg font-bold text-white">Activity Feed</h2>
                  </div>
                </div>
                <FollowingFeed />
              </section>

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
