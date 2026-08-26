import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { absoluteUrl } from "@/utils/siteUrl";
import Link from "@components/ui/AppLink";
import { CalendarDays } from "lucide-react";
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
import { getUserStats } from "@/utils/userStats";
import ProfileHighlights from "@components/profile/ProfileHighlights";
import ShareProfileCard from "@components/profile/ShareProfileCard";
import StatsSection from "@components/profile/StatsSection";
import FavoritesSection from "@components/profile/FavoritesSection";
import DeferredSection from "@components/profile/DeferredSection";
import { computeTasteSummary, buildTasteInsight, type TasteProfile, type TasteInsight } from "@/utils/tasteProfile";
import JsonLd from "@components/seo/JsonLd";
import { profileLd, breadcrumbLd } from "@/utils/structuredData";
import { profilePath } from "@/utils/urls";

export const dynamic = "force-dynamic";

/**
 * ── Why this page is not cached, said plainly ─────────────────────────────
 *
 * It is in the sitemap and it is the busiest kind of page here, so it is the
 * most tempting thing on the site to put behind a `revalidate`. It must not
 * be. What this page renders is not one document with a few personal corners
 * — it branches on `isOwner` throughout: the private diary notes, the edit
 * controls, the follow state, the visibility gate that decides whether a
 * stranger sees anything at all. ISR caches one render per URL and serves it
 * to whoever asks next, so the owner's own view of a private profile would
 * become the copy handed to the next visitor.
 *
 * That is not a tuning decision to revisit when the bill is high. It is the
 * one page here where caching and correctness genuinely conflict, so the cost
 * work is done inside the render instead: one round trip where there were two
 * (below), and nine in parallel where there were nine in series (further
 * down).
 */

/**
 * `generateMetadata` and `fetchProfileData` both looked this row up, by the
 * same username, in the same request, and neither knew about the other.
 *
 * The columns are the union of what the two of them asked for — `deleted_at`
 * comes from the metadata side, `banner_url`, `created_at`,
 * `featured_list_id` and `pinned_review_id` from the page — so sharing one
 * read costs nothing and saves a whole round trip on every profile render.
 */
const getProfileByUsername = cache(async (username: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select(
      "id, username, about, visibility, avatar_url, banner_url, tagline, created_at, featured_list_id, pinned_review_id, deleted_at",
    )
    .eq("username", username)
    .maybeSingle();
  return data;
});

/**
 * A profile is one of the two most-shared URLs in the product and had no
 * metadata at all, so every link to one rendered as a bare address.
 *
 * Built ONLY from a profile whose visibility is `public`. A followers-only or
 * private account gets the generic fallback and `robots: { index: false }` —
 * metadata is served before any session check the page itself performs, so
 * reading a display name or bio out of a non-public profile here would leak it
 * to anyone who pasted the link into a chat window that unfurls previews.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const fallback = { title: "Profile", robots: { index: false, follow: false } };

  try {
    const username = decodeURIComponent((await params).id ?? "");
    if (!username) return fallback;

    const profile = await getProfileByUsername(username);

    if (!profile || profile.deleted_at || profile.visibility !== "public") return fallback;

    const name = profile.username as string;
    const description =
      (profile.tagline as string | null)?.trim() ||
      (profile.about as string | null)?.trim() ||
      `What ${name} is watching, and what they thought of it.`;

    return {
      title: `${name}`,
      description,
      alternates: { canonical: absoluteUrl(`/app/profile/${encodeURIComponent(name)}`) },
      openGraph: {
        title: `${name} on LetSee`,
        description,
        url: absoluteUrl(`/app/profile/${encodeURIComponent(name)}`),
        type: "profile",
        ...(profile.avatar_url ? { images: [{ url: profile.avatar_url as string }] } : {}),
      },
      twitter: {
        card: "summary",
        title: `${name} on LetSee`,
        description,
      },
    };
  } catch {
    return fallback;
  }
}

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
    // Shared with `generateMetadata` via `cache()` — see above. `.maybeSingle()`
    // rather than the `.single()` this used to be: both end up here with a null
    // `data` when the username does not exist, but `single()` also logs a
    // PostgREST error to do it, and "that profile does not exist" is a normal
    // answer to a URL somebody typed.
    const data = await getProfileByUsername(username);
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

  /**
   * ── Nine queries that were standing in a queue for no reason ──────────────
   *
   * Everything below used to be a separate `await` on its own line: Taste in
   * 4, then favourites, then recent activity, then the diary notes, then
   * currently-watching, then the watchlist, then the taste pair, then the
   * featured list, then the pinned review. Nine sequential round trips to
   * Supabase, each one waiting for the previous to come back.
   *
   * None of them depends on the result of any other. Every input they need —
   * `profileId`, `isOwner`, `user.featured_list_id`, `user.pinned_review_id` —
   * is known before the first one starts. They were serial because that is
   * what writing one `await` per line does, not because anything required it.
   *
   * On a route rendered per request — and this one is, permanently, for the
   * reason set out above `dynamic` — the page's wall time was the *sum* of
   * nine network round trips. Now it is the slowest one. That is the same win
   * twice: a profile that appears faster for the person who opened it, and a
   * function that holds provisioned memory for a fraction as long, which is
   * the half of the bill that is measured in GB-hours.
   *
   * The conditional entries stay conditional — `null` in the array rather than
   * a query — so an owner-only read like the diary is still not issued for a
   * visitor, and a profile with no pinned review still asks for nothing.
   */
  const [
    favoriteDisplayRes,
    favoriteItemsRes,
    recentActivityRes,
    diaryRes,
    currentlyWatchingRes,
    watchlistRes,
    tasteRes,
    featuredListRes,
    pinnedReviewRes,
  ] = await Promise.all([
    // Taste in 4
    supabase.from("user_favorite_display").select("position, item_id, item_type, image_url, item_name").eq("user_id", profileId).order("position", { ascending: true }),

    // Favorite items (for Favorites section)
    supabase.from("favorite_items").select("id, user_id, item_id, item_type, item_name, image_url, genres, created_at").eq("user_id", profileId).order("created_at", { ascending: false }).limit(12),

    // Recent activity. review_text is the PRIVATE diary note — public_review_text
    // is the one meant for sharing — and ActivityFeed renders it inline, so it
    // only ever leaves the server for the owner.
    supabase.from("watched_items").select("id, item_id, item_type, item_name, image_url, watched_at").eq("user_id", profileId).eq("is_watched", true).order("watched_at", { ascending: false }).limit(10),

    /**
     * Nulling the column for visitors was the right intent and the wrong layer.
     * 019's policy makes the whole row readable to anyone who may see the
     * profile, so a visitor never had to come through this page to get the diary
     * — the anon key reads `select=review_text` off PostgREST directly. 076
     * revoked the column instead, which is why it is no longer in the select
     * above, and why the owner's copy now arrives through a SECURITY DEFINER
     * accessor that cannot be aimed at anybody else.
     */
    isOwner ? supabase.rpc("my_diary_notes") : null,

    // Currently watching
    supabase.from("user_media_status").select("item_id, item_type, item_name, image_url, genres").eq("user_id", profileId).eq("status", "watching").order("updated_at", { ascending: false }).limit(6),

    // Watch later — was counted in the stats strip but never actually listed anywhere.
    supabase.from("user_media_status").select("item_id, item_type, item_name, image_url, genres").eq("user_id", profileId).eq("status", "watchlist").order("updated_at", { ascending: false }).limit(12),

    // Taste profile + insight text. Kept as its own nested pair so the existing
    // "one failure here must not take the profile down with it" behaviour is
    // preserved — the `.catch` replaces the `try` that used to wrap it, and
    // resolving to `null` is what the empty defaults below read as "no taste
    // data", exactly as an exception did.
    Promise.all([
      supabase.from("watched_items").select("item_id, item_type, genres").eq("user_id", profileId).eq("is_watched", true).not("genres", "is", null),
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", profileId),
    ]).catch(() => null),

    // Featured list and pinned review
    user.featured_list_id
      ? supabase.from("user_lists").select("id, name").eq("id", user.featured_list_id).eq("user_id", profileId).maybeSingle()
      : null,
    user.pinned_review_id
      // No review_text: ProfileHighlights only links to the review, and passing
      // the private note as a prop would serialise it into the page payload.
      ? supabase.from("watched_items").select("id, item_id, item_type, item_name, watched_at").eq("id", user.pinned_review_id).eq("user_id", profileId).maybeSingle()
      : null,
  ]);

  const favoriteDisplay = favoriteDisplayRes.data;
  const favoriteItems = favoriteItemsRes.data;
  const currentlyWatching = currentlyWatchingRes.data;
  const watchlistItems = watchlistRes.data;

  const diaryByKey = new Map<string, string | null>(
    ((diaryRes?.data ?? []) as { item_id: string; item_type: string; review_text: string | null }[]).map(
      (n) => [`${n.item_type}:${n.item_id}`, n.review_text] as const,
    ),
  );
  const recentActivity = (recentActivityRes.data ?? []).map((item) => ({
    ...item,
    review_text: diaryByKey.get(`${item.item_type}:${item.item_id}`) ?? null,
  }));

  let tasteProfile: TasteProfile = { topGenres: [], loves: [], avoids: [], ratesHighest: null, totalGenresExplored: 0 };
  let tasteInsight: TasteInsight | null = null;
  const watchedItems = tasteRes?.[0]?.data;
  const ratings = tasteRes?.[1]?.data;
  if (watchedItems && ratings) {
    tasteProfile = computeTasteSummary(watchedItems, ratings);
    const avgRating = ratings.length ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : null;
    // stats.watchedCount, not watchedItems.length — the legacy watched_items
    // mirror carries rows user_media_status doesn't, so the blurb used to
    // claim a different total than the header right above it.
    tasteInsight = buildTasteInsight(user.username, tasteProfile, baseStats.watchedCount, avgRating);
  }

  const featuredList: { id: number; name: string } | null = featuredListRes?.data ?? null;
  const pinnedReview: any = pinnedReviewRes?.data ?? null;

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
    <>
      {/*
        `profileLd` was written when the schema helpers went in and then wired
        to nothing — the same shape of miss as the slug helpers. A public
        profile is a real entity page with a name, an avatar, a bio and a join
        date, and it is in the sitemap; it was the only listed page type with
        no structured data at all.

        Emitted only for a profile a stranger can actually read. Describing a
        followers-only account to a crawler would be handing out exactly what
        its owner asked the app to withhold.
      */}
      {visibility === "public" && !user.deleted_at && (
        <JsonLd
          data={[
            profileLd({
              username: user.username,
              about: user.about,
              tagline: user.tagline,
              avatarUrl: user.avatar_url,
              createdAt: user.created_at,
            }),
            breadcrumbLd([
              { name: "People", path: "/app/profile" },
              { name: `@${user.username}`, path: profilePath(user.username) },
            ]),
          ]}
        />
      )}
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

              {/* Year in Review. Linked from Stats because that's where
                  someone is already looking at their own numbers, and it's the
                  one page here built to leave the app as an image. */}
              <Link
                href={`/app/profile/${user.username}/year/${new Date().getUTCFullYear()}`}
                className="mt-4 flex items-center gap-3 rounded-xl border border-surface-800 bg-surface-900/40 px-4 py-3 hover:border-brand-500/30 transition-colors"
              >
                <CalendarDays className="size-4 shrink-0 text-brand-400" />
                <span className="text-sm text-surface-300">
                  {isOwner ? "Your" : `@${user.username}'s`} {new Date().getUTCFullYear()} in review
                </span>
                <span className="ml-auto text-surface-600">→</span>
              </Link>
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
    </>
  );
}
