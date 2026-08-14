import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { ShowFollowing, ShowFollower, FollowerBtnClient } from "@/components/profile/profileBtn";
import Logornot from "@components/guide/logornot";
import VisibilityGate from "@components/profile/VisibilityGate";
import ProfileHeroNew from "@components/profile/ProfileHeroNew";
import ProfileActionsDropdown from "@components/profile/ProfileActionsDropdown";
import Visibility from "@components/profile/visibility";
import WatchedGrid from "@components/profile/WatchedGrid";
import TrackedPosterCard from "@components/profile/TrackedPosterCard";
import ReviewsSection from "@components/profile/ReviewsSection";
import ListsSection from "@components/profile/ListsSection";
import TasteInFourStrip from "@components/profile/TasteInFourStrip";
import EditTasteInFour from "@components/profile/EditTasteInFour";
import FriendCompatibility from "@components/profile/FriendCompatibility";
import ActivityFeed from "@components/profile/ActivityFeed";
import ProfileTvProgress from "@components/profile/ProfileTvProgress";
import ProfileInsights from "@components/profile/ProfileInsights";
import AchievementsShelf from "@components/profile/AchievementsShelf";
import { getUserStats } from "@/utils/userStats";
import ProfileHighlights from "@components/profile/ProfileHighlights";
import ShareProfileCard from "@components/profile/ShareProfileCard";
import StatsSection from "@components/profile/StatsSection";
import FavoritesSection from "@components/profile/FavoritesSection";
import DeferredSection from "@components/profile/DeferredSection";
import { computeTasteSummary, buildTasteInsight, type TasteProfile, type TasteInsight } from "@/utils/tasteProfile";

export const dynamic = "force-dynamic";

async function fetchProfileData(username: string | null, currentUserId: string | null) {
  const supabase = await createClient();
  let profileId: string;
  let user: any;

  if (!username) {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) redirect("/login");
    const { data: profile } = await supabase.from("users").select("id, username, about, visibility, avatar_url, banner_url, tagline, created_at, featured_list_id, pinned_review_id").eq("id", authUser.id).single();
    if (!profile?.username) redirect("/app/welcome");
    user = profile; profileId = user.id;
  } else {
    const { data } = await supabase.from("users").select("id, username, about, visibility, avatar_url, banner_url, tagline, created_at, featured_list_id, pinned_review_id").eq("username", username).single();
    if (!data) return null;
    user = data; profileId = user.id;
  }

  const isOwner = currentUserId === profileId;

  // All counters come from getUserStats so the profile and the home sidebar
  // can't drift apart — they used to compute hours from different formulas.
  const [baseStats, { count: followersCount }, { count: followingCount }, { data: connection }] =
    await Promise.all([
      getUserStats(supabase, profileId),
      supabase.from("user_connections").select("*", { count: "exact", head: true }).eq("followed_id", profileId),
      supabase.from("user_connections").select("*", { count: "exact", head: true }).eq("follower_id", profileId),
      isOwner || !currentUserId ? { data: null } : supabase.from("user_connections").select("*").eq("follower_id", currentUserId!).eq("followed_id", profileId).single(),
    ]);

  const stats = {
    ...baseStats,
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
  };

  const followData = {
    followersCount: stats.followersCount,
    followingCount: stats.followingCount,
    isFollowing: !!connection?.id,
  };

  // Taste in 4
  const { data: favoriteDisplay } = await supabase.from("user_favorite_display").select("position, item_id, item_type, image_url, item_name").eq("user_id", profileId).order("position", { ascending: true });

  // Favorite items (for Favorites section)
  const { data: favoriteItems } = await supabase.from("favorite_items").select("id, user_id, item_id, item_type, item_name, image_url, genres, created_at").eq("user_id", profileId).order("created_at", { ascending: false }).limit(12);

  // Recent activity. review_text is the PRIVATE diary note — public_review_text
  // is the one meant for sharing — and ActivityFeed renders it inline, so it
  // only ever leaves the server for the owner.
  const { data: recentActivityRaw } = await supabase.from("watched_items").select("id, item_id, item_type, item_name, image_url, watched_at, review_text").eq("user_id", profileId).eq("is_watched", true).order("watched_at", { ascending: false }).limit(10);
  const recentActivity = (recentActivityRaw ?? []).map((item) =>
    isOwner ? item : { ...item, review_text: null },
  );

  // Currently watching
  const { data: currentlyWatching } = await supabase.from("user_media_status").select("item_id, item_type, item_name, image_url, genres").eq("user_id", profileId).eq("status", "watching").order("updated_at", { ascending: false }).limit(6);

  // Watch later — was counted in the stats strip but never actually listed anywhere.
  const { data: watchlistItems } = await supabase.from("user_media_status").select("item_id, item_type, item_name, image_url, genres").eq("user_id", profileId).eq("status", "watchlist").order("updated_at", { ascending: false }).limit(12);

  // Taste profile + insight text
  let tasteProfile: TasteProfile = { topGenres: [], loves: [], avoids: [], ratesHighest: null, totalGenresExplored: 0 };
  let tasteInsight: TasteInsight | null = null;
  try {
    const [{ data: watchedItems }, { data: ratings }] = await Promise.all([
      supabase.from("watched_items").select("item_id, item_type, genres").eq("user_id", profileId).eq("is_watched", true).not("genres", "is", null),
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", profileId),
    ]);
    if (watchedItems && ratings) {
      tasteProfile = computeTasteSummary(watchedItems, ratings);
      const avgRating = ratings.length ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : null;
      // stats.watchedCount, not watchedItems.length — the legacy watched_items
      // mirror carries rows user_media_status doesn't, so the blurb used to
      // claim a different total than the header right above it.
      tasteInsight = buildTasteInsight(user.username, tasteProfile, baseStats.watchedCount, avgRating);
    }
  } catch {}

  // Featured list and pinned review
  let featuredList: { id: number; name: string } | null = null;
  let pinnedReview: any = null;
  if (user.featured_list_id) {
    const { data: fl } = await supabase.from("user_lists").select("id, name").eq("id", user.featured_list_id).eq("user_id", profileId).maybeSingle();
    if (fl) featuredList = fl;
  }
  if (user.pinned_review_id) {
    // No review_text: ProfileHighlights only links to the review, and passing
    // the private note as a prop would serialise it into the page payload.
    const { data: pr } = await supabase.from("watched_items").select("id, item_id, item_type, item_name, watched_at").eq("id", user.pinned_review_id).eq("user_id", profileId).maybeSingle();
    if (pr) pinnedReview = pr;
  }

  return { user, isOwner, stats, followData, favoriteDisplay: favoriteDisplay ?? [], favoriteItems: favoriteItems ?? [], recentActivity, currentlyWatching: currentlyWatching ?? [], watchlistItems: watchlistItems ?? [], tasteProfile, tasteInsight, featuredList, pinnedReview };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: username } = await params;
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id || null;

  const profileData = await fetchProfileData(username, currentUserId);
  if (!profileData) return notFound();

  const { user, isOwner, stats, followData, favoriteDisplay, favoriteItems, recentActivity, currentlyWatching, watchlistItems, tasteProfile, tasteInsight, featuredList, pinnedReview } = profileData;
  if (!username && user.username) redirect(`/app/profile/${user.username}`);

  const visibility = String(user?.visibility ?? "public").toLowerCase();
  const canViewContent = isOwner || visibility === "public" || (visibility === "followers" && followData.isFollowing);
  const avatarSrc = user.avatar_url || "/avatar.svg";

  return (
    <div className="min-h-screen w-full bg-surface-950">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">

        {/* ═══ HERO — Who they are ═══ */}
        <ProfileHeroNew
          username={user.username} avatarSrc={avatarSrc} bannerUrl={user.banner_url || null}
          tagline={user.tagline || null} about={user.about || null} createdAt={user.created_at || ""}
          isOwner={isOwner} followersCount={followData.followersCount} followingCount={followData.followingCount}
          followButton={!isOwner && currentUserId ? <FollowerBtnClient profileId={user.id} currentUserId={currentUserId!} initialStatus={followData.isFollowing ? "following" : "follow"} profileVisibility={visibility} /> : <></>}
          messageLink={!isOwner && currentUserId ? <Link href={`/app/messages/${user.id}`} className="inline-flex items-center px-5 py-2.5 rounded-full bg-brand-500/10 hover:bg-brand-500/15 text-brand-300 text-sm font-medium border border-brand-500/20 transition-colors">Message</Link> : <></>}
          loginPrompt={!currentUserId ? <Logornot message="Log in to follow or message." /> : <></>}
          visibilityControl={isOwner ? <Visibility /> : <></>}
          actionsMenu={!isOwner && currentUserId ? <ProfileActionsDropdown profileId={user.id} currentUserId={currentUserId} /> : undefined}
          showFollow={!isOwner && !!currentUserId} showMessage={!isOwner && !!currentUserId} showLoginPrompt={!currentUserId}
          ShowFollowing={ShowFollowing} ShowFollower={ShowFollower}
          userId={user.id} stats={stats}
          completeness={{ hasAvatar: !!user.avatar_url, hasBanner: !!user.banner_url, hasTagline: !!user.tagline, hasBio: !!user.about, tasteInFourFilled: favoriteDisplay.length === 4, hasFeaturedList: !!featuredList, hasPinnedReview: !!pinnedReview }}
        />

        {!canViewContent ? (
          <VisibilityGate
            username={user.username} avatarSrc={avatarSrc} tagline={user.tagline}
            visibility={visibility}
            stats={{ watchedCount: stats.watchedCount, favoriteCount: stats.favoriteCount, watchlistCount: stats.watchlistCount, followersCount: followData.followersCount, followingCount: followData.followingCount }}
            isLoggedIn={!!currentUserId}
            followButton={currentUserId ? <FollowerBtnClient profileId={user.id} currentUserId={currentUserId} initialStatus={followData.isFollowing ? "following" : "follow"} profileVisibility={visibility} /> : undefined}
            loginPrompt={!currentUserId ? <Logornot message="Log in to follow." /> : undefined}
          />
        ) : (
          <>
            {/* ═══ AT A GLANCE — Personality snapshot ═══ */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-brand-500" />
                At a Glance
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-xl border border-surface-800/50 bg-surface-900/30 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Taste in 4</h3>
                    {isOwner && <EditTasteInFour currentItems={favoriteDisplay} profileId={user.id} />}
                  </div>
                  {favoriteDisplay.length > 0 ? <TasteInFourStrip items={favoriteDisplay} /> : <p className="text-surface-500 text-sm py-4">{isOwner ? "Add your 4 favorites to showcase your taste." : "No favorites added yet."}</p>}
                </div>
                <div>
                  <ProfileInsights insight={tasteInsight} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                {tasteProfile.topGenres.length > 0 && (
                  <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-5">
                    <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">Top Genres</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {tasteProfile.topGenres.slice(0, 8).map((g) => {
                        // Watch count is the signal everyone has; the rating
                        // affinity is a bonus only some genres have earned.
                        const liked = g.affinity !== null && g.affinity > 20;
                        const disliked = g.affinity !== null && g.affinity < -20;
                        const tone = liked
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : disliked
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-surface-800/80 text-surface-300 border-surface-700/40";
                        return (
                          <span
                            key={g.genre}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${tone}`}
                            title={
                              g.ratedCount > 0
                                ? `${g.count} watched · ${g.ratedCount} rated`
                                : `${g.count} watched · none rated yet`
                            }
                          >
                            {g.genre} · {g.count}
                            {g.affinity !== null && (
                              <span className="opacity-70">
                                {" "}
                                {g.affinity > 0 ? `+${g.affinity}` : g.affinity}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!isOwner && currentUserId && <FriendCompatibility profileId={user.id} />}
              </div>

              <div className="mt-4">
                <AchievementsShelf userId={user.id} />
              </div>

              {/* Featured list + pinned review. Both were already fetched
                  above and then thrown away — the component existed but was
                  never mounted. */}
              <div className="mt-4">
                <ProfileHighlights featuredList={featuredList} pinnedReview={pinnedReview} />
              </div>
            </section>

            {/* ═══ FAVORITES — What they love ═══ */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-rose-500" />
                Favorites
              </h2>
              <DeferredSection>
                <FavoritesSection
                  userId={user.id}
                  isOwner={isOwner}
                  initialItems={favoriteItems}
                  totalCount={stats.favoriteCount}
                />
              </DeferredSection>
            </section>

            {/* ═══ CURRENTLY WATCHING — What they're into now ═══ */}
            {currentlyWatching.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-amber-500" />
                  Currently Watching
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {currentlyWatching.map((item: any) => (
                    <TrackedPosterCard
                      key={item.item_id}
                      itemId={String(item.item_id)}
                      itemType={item.item_type}
                      itemName={item.item_name}
                      imageUrl={item.image_url}
                      genres={item.genres ?? []}
                      accent="group-hover:border-amber-500/40"
                      interactive={isOwner}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ═══ WATCH LATER — What they're saving for later ═══ */}
            {watchlistItems.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="w-1 h-5 rounded-full bg-purple-500" />
                    Watch Later
                    <span className="text-sm font-normal text-surface-500">
                      {stats.watchlistCount}
                    </span>
                  </h2>
                  {isOwner && (
                    <Link
                      href="/app/watchlist"
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      Manage →
                    </Link>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {watchlistItems.map((item: any) => (
                    <TrackedPosterCard
                      key={item.item_id}
                      itemId={String(item.item_id)}
                      itemType={item.item_type}
                      itemName={item.item_name}
                      imageUrl={item.image_url}
                      genres={item.genres ?? []}
                      accent="group-hover:border-purple-500/40"
                      interactive={isOwner}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ═══ RECENT ACTIVITY — What they've been doing ═══ */}
            {recentActivity.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full bg-purple-500" />
                  Recent Activity
                </h2>
                <ActivityFeed items={recentActivity.map((item: any) => ({ ...item, activity_type: "watched" as const }))} />
              </section>
            )}

            {/* Film Diary lived here. It ran the same query as Films below —
                watched_items where is_watched, newest first — with fewer
                filters, and watched_items is UNIQUE (user_id, item_id) so it
                could never record a rewatch, which is the only thing a diary
                offers over a library. */}

            {/* ═══ FILMS — Their complete library ═══ */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-emerald-500" />
                Films
              </h2>
              <DeferredSection>
                <WatchedGrid userId={user.id} isOwner={isOwner} />
              </DeferredSection>
            </section>

            {/* ═══ TV PROGRESS — Shows they're tracking ═══ */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-blue-500" />
                TV Progress
              </h2>
              <DeferredSection>
                <ProfileTvProgress userId={user.id} isOwner={isOwner} />
              </DeferredSection>
            </section>

            {/* ═══ REVIEWS — Their thoughts ═══ */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-brand-500" />
                Reviews
              </h2>
              <DeferredSection>
                <ReviewsSection userId={user.id} isOwner={isOwner} />
              </DeferredSection>
            </section>

            {/* ═══ LISTS — Their curated collections ═══ */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-rose-500" />
                Lists
              </h2>
              <DeferredSection>
                <ListsSection profileId={user.id} isOwner={isOwner} />
              </DeferredSection>
            </section>

            {/* ═══ STATS — The numbers ═══ */}
            <section>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-amber-500" />
                Stats
              </h2>
              <DeferredSection>
                <StatsSection
                  userId={user.id}
                  isOwner={isOwner}
                  // episodesCount was hardcoded to 0 here, so Stats reported no
                  // episodes while getUserStats already had the real figure.
                  stats={{ watchedCount: stats.watchedCount, favoriteCount: stats.favoriteCount, watchlistCount: stats.watchlistCount, watchingCount: stats.watchingCount, watchedThisYear: stats.watchedThisYear, movieCount: stats.movieCount, tvCount: stats.tvCount, episodesCount: stats.episodesCount }}
                  initialGenres={tasteProfile.topGenres.map((g) => ({ genre: g.genre, count: g.count }))}
                />
              </DeferredSection>
            </section>

            {/* ═══ SHARE ═══ */}
            {isOwner && (
              <section>
                <ShareProfileCard
                  username={user.username} avatarUrl={avatarSrc}
                  tagline={user.tagline}
                  stats={{ watchedCount: stats.watchedCount, favoriteCount: stats.favoriteCount, watchlistCount: stats.watchlistCount, followersCount: followData.followersCount, followingCount: followData.followingCount }}
                  topGenres={tasteProfile.topGenres.slice(0, 5).map((g) => g.genre)}
                  tasteInFour={favoriteDisplay}
                />
              </section>
            )}
          </>
        )}

        {/* ═══ FOOTER ═══ */}
        <div className="text-center text-[10px] text-surface-600 pt-4 border-t border-surface-800/30">
          <span>Joined {new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          <span className="mx-2">·</span>
          <span>@{user.username}</span>
        </div>
      </div>
    </div>
  );
}
