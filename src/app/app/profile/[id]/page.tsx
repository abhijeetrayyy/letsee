import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import {
  ShowFollowing,
  ShowFollower,
  FollowerBtnClient,
} from "@/components/profile/profllebtn";
import ProfileLists from "@components/profile/ProfileLists";
import Visibility from "@components/profile/visibility";
import Logornot from "@components/guide/logornot";
import RecommendationTile from "@components/profile/recomendation";
import TasteInFourStrip from "@components/profile/TasteInFourStrip";
import EditTasteInFour from "@components/profile/EditTasteInFour";
import ProfileHighlights from "@components/profile/ProfileHighlights";
import ProfileTvProgress from "@components/profile/ProfileTvProgress";
import ProfileCurrentlyWatching from "@components/profile/ProfileCurrentlyWatching";
import ProfileAnimeSection from "@components/profile/ProfileAnimeSection";
import VisibilityGate from "@components/profile/VisibilityGate";
import ProfileHeroNew from "@components/profile/ProfileHeroNew";
import ProfileTabsNew from "@components/profile/ProfileTabsNew";
import FilmDiary from "@components/profile/FilmDiary";
import ReviewsSection from "@components/profile/ReviewsSection";
import WatchedGrid from "@components/profile/WatchedGrid";
import ListsSection from "@components/profile/ListsSection";
import StatsSection from "@components/profile/StatsSection";
import ActivityFeed from "@components/profile/ActivityFeed";

export const dynamic = "force-dynamic";

// Fetch user data and statistics
const fetchProfileData = async (
  username: string | null,
  currentUserId: string | null,
) => {
  const supabase = await createClient();

  let profileId: string;
  let user: any;

  if (!username) {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();
    if (error || !authUser) redirect("/login");

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select(
        "id, username, about, visibility, avatar_url, banner_url, tagline",
      )
      .eq("id", authUser.id)
      .single();

    if (profileError || !profile) redirect("/app/profile/setup");
    if (!profile.username) redirect("/app/profile/setup");

    user = profile;
    profileId = user.id;
  } else {
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, username, about, visibility, avatar_url, banner_url, tagline",
      )
      .eq("username", username)
      .single();

    if (error || !data) return null;
    user = data;
    profileId = user.id;
  }

  try {
    const { data: ext } = await supabase
      .from("users")
      .select("featured_list_id, pinned_review_id")
      .eq("id", profileId)
      .maybeSingle();
    if (ext) Object.assign(user, ext);
  } catch {
    // columns may not exist before migration 011
  }

  const isOwner = currentUserId === profileId;

  const [
    { count: watchedCount },
    { count: favoriteCount },
    { count: watchlistCount },
    { count: watchingCount },
    { count: followersCount },
    { count: followingCount },
    { data: connection },
  ] = await Promise.all([
    supabase
      .from("watched_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId)
      .eq("is_watched", true),
    supabase
      .from("favorite_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId),
    supabase
      .from("user_watchlist")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId),
    supabase
      .from("currently_watching")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId),
    supabase
      .from("user_connections")
      .select("*", { count: "exact", head: true })
      .eq("followed_id", profileId),
    supabase
      .from("user_connections")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profileId),
    isOwner || !currentUserId
      ? { data: null }
      : supabase
          .from("user_connections")
          .select("*")
          .eq("follower_id", currentUserId!)
          .eq("followed_id", profileId)
          .single(),
  ]);

  const followData = {
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
    isFollowing: !!connection?.id,
  };

  let favoriteDisplay: {
    position: number;
    item_id: string;
    item_type: string;
    image_url: string | null;
    item_name: string;
  }[] = [];
  try {
    const { data: fd } = await supabase
      .from("user_favorite_display")
      .select("position, item_id, item_type, image_url, item_name")
      .eq("user_id", profileId)
      .order("position", { ascending: true });
    favoriteDisplay = fd ?? [];
  } catch {
    // table may not exist before migration 011
  }

  const { data: recentWatched } = await supabase
    .from("watched_items")
    .select(
      "id, item_id, item_type, item_name, image_url, watched_at, review_text",
    )
    .eq("user_id", profileId)
    .eq("is_watched", true)
    .order("watched_at", { ascending: false })
    .limit(10);

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const [
    { count: watchedThisYear },
    { count: movieCount },
    { count: tvCount },
    { count: episodesCount },
  ] = await Promise.all([
    supabase
      .from("watched_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId)
      .eq("is_watched", true)
      .gte("watched_at", yearStart),
    supabase
      .from("watched_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId)
      .eq("is_watched", true)
      .eq("item_type", "movie"),
    supabase
      .from("watched_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId)
      .eq("is_watched", true)
      .eq("item_type", "tv"),
    supabase
      .from("watched_episodes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profileId),
  ]);

  const totalWatched = watchedCount ?? 0;
  const movies = movieCount ?? 0;
  const tv = tvCount ?? 0;
  const episodes = episodesCount ?? 0;

  let featuredList: { id: number; name: string } | null = null;
  let pinnedReview: {
    id: number;
    item_id: string;
    item_type: string;
    item_name: string;
    review_text: string | null;
    watched_at: string;
  } | null = null;
  const uid = user as {
    featured_list_id?: number | null;
    pinned_review_id?: number | null;
  };
  if (uid.featured_list_id) {
    const { data: fl } = await supabase
      .from("user_lists")
      .select("id, name")
      .eq("id", uid.featured_list_id)
      .eq("user_id", profileId)
      .maybeSingle();
    if (fl) featuredList = fl;
  }
  if (uid.pinned_review_id) {
    const { data: pr } = await supabase
      .from("watched_items")
      .select("id, item_id, item_type, item_name, review_text, watched_at")
      .eq("id", uid.pinned_review_id)
      .eq("user_id", profileId)
      .maybeSingle();
    if (pr) pinnedReview = pr;
  }

  return {
    user,
    isOwner,
    featuredList,
    pinnedReview,
    stats: {
      watchedCount: totalWatched,
      favoriteCount: favoriteCount ?? 0,
      watchlistCount: watchlistCount ?? 0,
      watchingCount: watchingCount ?? 0,
      watchedThisYear: watchedThisYear ?? 0,
      movieCount: movies,
      tvCount: tv,
      episodesCount: episodes,
    },
    followData,
    favoriteDisplay,
    recentActivity: recentWatched ?? [],
  };
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { id: username } = await params;
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  const currentUserId = currentUser?.id || null;

  // Fetch profile data
  const profileData = await fetchProfileData(username, currentUserId);
  if (!profileData) return notFound();

  const {
    user,
    isOwner,
    stats,
    followData,
    favoriteDisplay,
    recentActivity,
    featuredList,
    pinnedReview,
  } = profileData;

  // Redirect if username fetched and not in URL
  if (!username && user.username) {
    redirect(`/app/profile/${user.username}`);
  }

  // Determine content visibility
  const visibility = String(user?.visibility ?? "public").toLowerCase();
  const canViewContent =
    isOwner ||
    visibility === "public" ||
    (visibility === "followers" && followData.isFollowing);

  const avatarSrc = user.avatar_url || "/avatar.svg";

  return (
    <div className="min-h-screen w-full bg-surface-950">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,197,94,0.04),transparent)] pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
        {/* Hero Section */}
        <ProfileHeroNew
          username={user.username}
          avatarSrc={avatarSrc}
          bannerUrl={user.banner_url || null}
          tagline={user.tagline || null}
          about={user.about || null}
          isOwner={isOwner}
          followersCount={followData.followersCount ?? 0}
          followingCount={followData.followingCount ?? 0}
          followButton={
            <FollowerBtnClient
              profileId={user.id}
              currentUserId={currentUserId!}
              initialStatus={followData.isFollowing ? "following" : "follow"}
            />
          }
          messageLink={
            <Link
              href={`/app/messages/${user.id}`}
              className="inline-flex items-center px-5 py-2.5 rounded-full bg-brand-500/10 hover:bg-brand-500/15 text-brand-300 text-sm font-medium border border-brand-500/20 transition-colors"
            >
              Message
            </Link>
          }
          loginPrompt={<Logornot message="Log in to follow or message." />}
          showFollow={!isOwner && !!currentUserId}
          showMessage={!isOwner && !!currentUserId}
          showLoginPrompt={!currentUserId}
          ShowFollowing={ShowFollowing}
          ShowFollower={ShowFollower}
          visibilityControl={<Visibility />}
          userId={user.id}
          stats={{
            watchedCount: stats.watchedCount,
            favoriteCount: stats.favoriteCount,
            watchlistCount: stats.watchlistCount,
            watchingCount: stats.watchingCount,
          }}
        />

        {/* Taste in 4 */}
        <section aria-label="Taste in 4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Taste in 4
            </h2>
            {isOwner && (
              <div className="flex items-center gap-2">
                {favoriteDisplay.length === 0 && (
                  <span className="text-surface-500 text-sm hidden sm:inline">
                    Add your 4 favorites
                  </span>
                )}
                <EditTasteInFour
                  currentItems={favoriteDisplay}
                  profileId={user.id}
                />
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-surface-800/50 bg-surface-900/30 p-6">
            {favoriteDisplay.length === 0 && !isOwner ? (
              <p className="text-surface-500 text-sm text-center py-6">
                No favorites added yet.
              </p>
            ) : favoriteDisplay.length === 0 && isOwner ? (
              <p className="text-surface-500 text-sm text-center py-6">
                Add your 4 favorite titles above to show your taste at a glance.
              </p>
            ) : (
              <TasteInFourStrip items={favoriteDisplay} />
            )}
          </div>
        </section>

        {/* Currently watching */}
        {canViewContent && (
          <section aria-label="Currently watching">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
              Currently watching
            </h2>
            <div className="rounded-2xl border border-surface-800/50 bg-surface-900/30 p-6">
              <ProfileCurrentlyWatching userId={user.id} />
            </div>
          </section>
        )}

        {/* Anime TV series */}
        {canViewContent && (
          <ProfileAnimeSection
            userId={user.id}
            isOwner={isOwner}
            type="tv"
            sectionTitle="Anime TV series"
          />
        )}

        {/* Anime movies */}
        {canViewContent && (
          <ProfileAnimeSection
            userId={user.id}
            isOwner={isOwner}
            type="movie"
            sectionTitle="Anime movies"
          />
        )}

        {/* Highlights */}
        {(featuredList || pinnedReview) && (
          <section aria-label="Highlights">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
              Highlights
            </h2>
            <ProfileHighlights
              featuredList={featuredList}
              pinnedReview={pinnedReview}
            />
          </section>
        )}

        {/* Series progress */}
        {canViewContent && (
          <section aria-label="Series progress">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
              Series progress
            </h2>
            <p className="text-sm text-surface-400 mb-4">
              Episodes and seasons completed per show
            </p>
            <ProfileTvProgress userId={user.id} isOwner={isOwner} />
          </section>
        )}

        {/* Main Tabs: Diary | Reviews | Films | Lists | Stats | Activity */}
        {canViewContent ? (
          <section aria-label="Profile content">
            <div className="rounded-2xl border border-surface-800/50 bg-surface-900/30 p-6">
              <ProfileTabsNew
                diary={
                  <FilmDiary userId={user.id} isOwner={isOwner} />
                }
                reviews={
                  <ReviewsSection userId={user.id} isOwner={isOwner} />
                }
                films={
                  <WatchedGrid userId={user.id} isOwner={isOwner} />
                }
                lists={
                  <ListsSection profileId={user.id} isOwner={isOwner} />
                }
                stats={
                  <StatsSection
                    userId={user.id}
                    isOwner={isOwner}
                    stats={{
                      watchedCount: stats.watchedCount,
                      favoriteCount: stats.favoriteCount,
                      watchlistCount: stats.watchlistCount,
                      watchingCount: stats.watchingCount,
                      watchedThisYear: stats.watchedThisYear,
                      movieCount: stats.movieCount,
                      tvCount: stats.tvCount,
                      episodesCount: stats.episodesCount,
                    }}
                  />
                }
                activity={
                  <>
                    <RecommendationTile
                      isOwner={isOwner}
                      name={user.username}
                      id={user.id}
                    />
                    <ActivityFeed
                      items={(recentActivity ?? []).map((item: any) => ({
                        ...item,
                        activity_type: "watched" as const,
                      }))}
                    />
                  </>
                }
              />
            </div>
          </section>
        ) : (
          <VisibilityGate
            username={user.username}
            avatarSrc={avatarSrc}
            followButton={
              currentUserId ? (
                <FollowerBtnClient
                  profileId={user.id}
                  currentUserId={currentUserId}
                  initialStatus={
                    followData.isFollowing ? "following" : "follow"
                  }
                />
              ) : undefined
            }
            loginPrompt={
              !currentUserId ? (
                <Logornot message="Log in to follow." />
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
