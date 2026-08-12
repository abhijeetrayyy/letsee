import Link from "next/link";
import { getHomeContent } from "@/utils/homeData";
import { createClient } from "@/utils/supabase/server";
import HomeHero from "@components/home/HomeHero";
import QuickActions from "@components/home/QuickActions";
import TrendingNow from "@components/home/TrendingNow";
import GenreExplorer from "@components/home/GenreExplorer";
import CollectionRow from "@components/home/CollectionRow";
import UserSidebar from "@components/home/UserSidebar";
import ContinueWatchingProgress from "@components/tv/ContinueWatchingProgress";
import QuickPick from "@components/home/QuickPick";
import FollowingFeed from "@components/feed/FollowingFeed";
import AiringSoon from "@components/home/AiringSoon";
import PeopleYouMayKnow from "@components/home/PeopleYouMayKnow";
import DiscoverUsers from "@components/home/DiscoverUser";
import CommunityLeaderboard from "@components/home/CommunityLeaderboard";
import ClubPickWidget from "@components/home/ClubPickWidget";
import { Film, TrendingUp, Compass, Tv, Sparkles, Flame } from "lucide-react";

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
                  <div className="pt-2">
                    <QuickPick />
                  </div>
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

              {/* Community discovery — visible to everyone. A signed-out
                  visitor seeing zero humans is the worst possible first
                  impression for a community product. PeopleYouMayKnow stays
                  gated because its matches are relative to your own taste. */}
              <ClubPickWidget />
              {isLoggedIn && <PeopleYouMayKnow />}
              <DiscoverUsers hideTitleLink />
              <CommunityLeaderboard />
            </aside>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <main className="flex-1 min-w-0 order-1 lg:order-2 space-y-10">
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

              {/* Weekly Top 20 */}
              {content.weeklyTop.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Tv className="size-4 text-accent-gold" />
                      <h2 className="text-lg font-bold text-white">Top This Week</h2>
                    </div>
                  </div>
                  <CollectionRow items={content.weeklyTop} showRank />
                </section>
              )}

              {/* Anime Section */}
              {(content.animeSeries.length > 0 || content.animeFilms.length > 0) && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-purple-400" />
                      <h2 className="text-lg font-bold text-white">Anime</h2>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {content.animeSeries.length > 0 && (
                      <CollectionRow items={content.animeSeries} label="Popular Series" mediaType="tv" />
                    )}
                    {content.animeFilms.length > 0 && (
                      <CollectionRow items={content.animeFilms} label="Popular Films" mediaType="movie" />
                    )}
                  </div>
                </section>
              )}

              {/* Curated Collections */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-rose-400" />
                    <h2 className="text-lg font-bold text-white">Curated Collections</h2>
                  </div>
                </div>
                <div className="space-y-8">
                  {content.collections.romance.length > 0 && (
                    <CollectionRow items={content.collections.romance} label="Romance & Love" accent="rose" />
                  )}
                  {content.collections.action.length > 0 && (
                    <CollectionRow items={content.collections.action} label="Action" accent="amber" />
                  )}
                  {content.collections.crime.length > 0 && (
                    <CollectionRow items={content.collections.crime} label="Crime" accent="slate" />
                  )}
                  {content.collections.thriller.length > 0 && (
                    <CollectionRow items={content.collections.thriller} label="Thrills" accent="emerald" />
                  )}
                  {content.collections.horror.length > 0 && (
                    <CollectionRow items={content.collections.horror} label="Horror" accent="red" />
                  )}
                </div>
              </section>

              {/* Genre Explorer */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Compass className="size-4 text-blue-400" />
                    <h2 className="text-lg font-bold text-white">Browse by Genre</h2>
                  </div>
                </div>
                <GenreExplorer movieGenres={content.movieGenres} tvGenres={content.tvGenres} />
              </section>

              {/* Bollywood */}
              {content.bollywood.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Film className="size-4 text-orange-400" />
                      <h2 className="text-lg font-bold text-white">Bollywood</h2>
                    </div>
                  </div>
                  <CollectionRow items={content.bollywood} mediaType="movie" />
                </section>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

