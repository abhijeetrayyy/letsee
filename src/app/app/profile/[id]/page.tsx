import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import {
  ShowFollowing,
  ShowFollower,
  FollowerBtnClient,
} from "@/components/profile/profllebtn";
import ProfileContent from "@components/profile/profileContent";
import ProfileLists from "@components/profile/ProfileLists";
import Visibility from "@components/profile/visibility";
import StatisticsGenre from "@components/profile/statisticsGenre";
import Logornot from "@components/guide/logornot";
import RecommendationTile from "@components/profile/recomendation";
import TasteInFourStrip from "@components/profile/TasteInFourStrip";
import EditTasteInFour from "@components/profile/EditTasteInFour";
import RecentActivityStrip from "@components/profile/RecentActivityStrip";
import ProfileTabs from "@components/profile/ProfileTabs";
import ProfileHero from "@components/profile/ProfileHero";
import ProfileHighlights from "@components/profile/ProfileHighlights";
import ProfileStatsStrip from "@components/profile/ProfileStatsStrip";
import ProfileTvProgress from "@components/profile/ProfileTvProgress";
import ProfileReviewsRatingsDiaryRows from "@components/profile/ProfileReviewsRatingsDiaryRows";
import ProfileCurrentlyWatching from "@components/profile/ProfileCurrentlyWatching";
import VisibilityGate from "@components/profile/VisibilityGate";

export const dynamic = "force-dynamic";

// Fetch user data and statistics. Uses only the viewer's Supabase client; RLS (profile_visible_to_viewer) allows reading when profile is public or followers+follow.
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

  // Determine content visibility (normalize: DB enum is lowercase; default to public so "Public" profile is visible)
  const visibility = String(user?.visibility ?? "public").toLowerCase();
  const canViewContent =
    isOwner ||
    visibility === "public" ||
    (visibility === "followers" && followData.isFollowing);

  const avatarSrc = user.avatar_url || "/avatar.svg";
  const SECTION_TITLE =
    "text-xl sm:text-2xl font-bold text-white tracking-tight mb-4";

  return (
    <div className="min-h-screen w-full bg-neutral-950">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,40,0.08),transparent)] pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
        {/* Hero — full-bleed feel */}
        <ProfileHero
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
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium border border-white/10 transition-colors"
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
        />

        {/* Taste in 4 */}
        <section aria-label="Taste in 4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className={SECTION_TITLE}>Taste in 4</h2>
            {isOwner && (
              <div className="flex items-center gap-2">
                {favoriteDisplay.length === 0 && (
                  <span className="text-neutral-500 text-sm hidden sm:inline">
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
          <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-6">
            {favoriteDisplay.length === 0 && !isOwner ? (
              <p className="text-neutral-500 text-sm text-center py-6">
                No favorites added yet.
              </p>
            ) : favoriteDisplay.length === 0 && isOwner ? (
              <p className="text-neutral-500 text-sm text-center py-6">
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
            <h2 className={SECTION_TITLE}>Currently watching</h2>
            <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-6">
              <ProfileCurrentlyWatching userId={user.id} />
            </div>
          </section>
        )}

        {/* Stats strip */}
        <section aria-label="Statistics">
          <h2 className={SECTION_TITLE}>Stats</h2>
          <ProfileStatsStrip
            stats={[
              { value: stats.watchedCount, label: "Watched" },
              { value: stats.watchingCount ?? 0, label: "Watching" },
              { value: stats.movieCount ?? 0, label: "Movies" },
              { value: stats.tvCount ?? 0, label: "TV" },
              { value: stats.episodesCount ?? 0, label: "Episodes" },
              { value: stats.favoriteCount, label: "Favorites" },
              { value: stats.watchlistCount, label: "Watchlist" },
              {
                value: stats.watchedThisYear,
                label: `This year (${new Date().getFullYear()})`,
              },
            ]}
            moviesCount={stats.movieCount ?? 0}
            tvCount={stats.tvCount ?? 0}
            episodesCount={stats.episodesCount ?? 0}
          />
        </section>

        {/* Reviews, ratings & diary — prominent upper section */}
        {canViewContent && (
          <section
            aria-label="Reviews, ratings and diary"
            className="rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-6"
          >
            <h2 className={SECTION_TITLE}>Reviews, ratings & diary</h2>
            {isOwner && (
              <div className="text-sm text-neutral-400 mb-4 max-w-2xl space-y-2">
                <p>
                  Each row shows a title you’ve watched with a{" "}
                  <strong className="text-neutral-300">rating</strong> (1–10),{" "}
                  <strong className="text-neutral-300">public review</strong>,
                  and <strong className="text-neutral-300">your diary</strong>{" "}
                  (private notes). Your diary is only visible to you and is
                  never shown to visitors. Add or edit from the movie or TV page
                  (open the title from the link). Control who sees ratings and
                  public reviews via the visibility settings at the top of your
                  profile.
                </p>
              </div>
            )}
            <ProfileReviewsRatingsDiaryRows
              userId={user.id}
              isOwner={isOwner}
            />
          </section>
        )}

        {/* Highlights */}
        {(featuredList || pinnedReview) && (
          <section aria-label="Highlights">
            <h2 className={SECTION_TITLE}>Highlights</h2>
            <ProfileHighlights
              featuredList={featuredList}
              pinnedReview={pinnedReview}
            />
          </section>
        )}

        {/* Top genres */}
        <section
          aria-label="Top genres"
          className="rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-6"
        >
          <StatisticsGenre username={user.username} userId={user.id} />
        </section>

        {/* Series progress (episode-level TV tracking) — visible to profile owner and visitors */}
        {canViewContent && (
          <section aria-label="Series progress">
            <h2 className={SECTION_TITLE}>Series progress</h2>
            <p className="text-sm text-neutral-400 mb-4">
              Episodes and seasons completed per show
            </p>
            <ProfileTvProgress userId={user.id} isOwner={isOwner} />
          </section>
        )}

        {/* Content: tabs or visibility gate */}
        {canViewContent ? (
          <section id="activity-and-lists" aria-label="Activity and lists">
            <h2 className={SECTION_TITLE}>Activity & lists</h2>
            <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/30 p-6">
              <ProfileTabs
                activity={<RecentActivityStrip items={recentActivity} />}
                lists={<ProfileLists profileId={user.id} isOwner={isOwner} />}
                all={
                  <>
                    <RecommendationTile
                      isOwner={isOwner}
                      name={user.username}
                      id={user.id}
                    />
                    <ProfileContent profileId={user.id} isOwner={isOwner} />
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
