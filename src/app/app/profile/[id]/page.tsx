import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { absoluteUrl } from "@/utils/siteUrl";
import { getUserStats } from "@/utils/userStats";
import JsonLd from "@components/seo/JsonLd";
import { profileLd, breadcrumbLd } from "@/utils/structuredData";
import { profilePath } from "@/utils/urls";
import ProfileV2 from "@components/profile/v2/ProfileV2";

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
 * work is done inside the render instead, and the render now reads only what
 * the first screen shows; the library, diary, reviews, lists and stats load in
 * the browser when their folds are opened.
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

/**
 * What the profile's first screen needs, and nothing it doesn't.
 *
 * The old page read a dozen things on every render — favourites, recent
 * activity, the diary notes, the watchlist, a featured list, a pinned review,
 * the taste aggregate — for sections that now sit in folds and load in the
 * browser when opened. Seven small reads remain, all in parallel.
 */
async function fetchProfileData(username: string | null, currentUserIdInput: Promise<string | null>) {
  const supabase = await createClient();
  let user: Awaited<ReturnType<typeof getProfileByUsername>>;
  let currentUserId: string | null;

  if (!username) {
    currentUserId = await currentUserIdInput;
    if (!currentUserId) redirect("/login");
    const { data: profile } = await supabase
      .from("users")
      .select("id, username, about, visibility, avatar_url, banner_url, tagline, created_at, featured_list_id, pinned_review_id, deleted_at")
      .eq("id", currentUserId)
      .single();
    if (!profile?.username) redirect("/app/welcome");
    user = profile;
  } else {
    const [data, resolved] = await Promise.all([getProfileByUsername(username), currentUserIdInput]);
    currentUserId = resolved;
    if (!data) return null;
    user = data;
  }
  if (!user) return null;

  const profileId = user.id as string;
  const isOwner = currentUserId === profileId;
  const visibility = String(user.visibility ?? "public").toLowerCase();

  // Diary entries since the first of this month (UTC), for the hero's "this
  // month": a head-only count, under the same RLS as the diary itself.
  const now = new Date();
  const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [stats, followers, following, connection, four, watching, month] = await Promise.all([
    getUserStats(supabase, profileId),
    supabase.from("user_connections").select("id", { count: "exact", head: true }).eq("followed_id", profileId),
    supabase.from("user_connections").select("id", { count: "exact", head: true }).eq("follower_id", profileId),
    // Only a followers-only profile needs to know whether this visitor follows.
    !isOwner && currentUserId && visibility === "followers"
      ? supabase.from("user_connections").select("id").eq("follower_id", currentUserId).eq("followed_id", profileId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("user_favorite_display").select("position, item_id, item_type, image_url, item_name").eq("user_id", profileId).order("position", { ascending: true }),
    supabase.from("user_media_status").select("item_id, item_type, item_name, image_url").eq("user_id", profileId).eq("status", "watching").order("updated_at", { ascending: false }).limit(8),
    supabase.from("viewings").select("id", { count: "exact", head: true }).eq("user_id", profileId).gte("watched_on", monthStart),
  ]);

  const isFollowing = !!connection.data;
  const canView = isOwner || visibility === "public" || (visibility === "followers" && isFollowing);

  return {
    user,
    visibility,
    data: {
      user: {
        id: profileId,
        username: user.username as string,
        avatarUrl: (user.avatar_url as string | null) ?? null,
        tagline: (user.tagline as string | null) ?? null,
        about: (user.about as string | null) ?? null,
        createdAt: (user.created_at as string | null) ?? "",
        visibility,
      },
      isOwner,
      viewerId: currentUserId,
      canView,
      isFollowing,
      four: canView ? four.data ?? [] : [],
      watching: canView ? watching.data ?? [] : [],
      stats,
      thisMonth: canView ? month.count ?? 0 : 0,
      followersCount: followers.count ?? 0,
      followingCount: following.count ?? 0,
      tasteStats: null,
    },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: username } = await params;
  // Read from the token, not asked of the auth server (getAuthUserId → getClaims).
  const currentUserIdPromise = getAuthUserId();

  const profile = await fetchProfileData(username ? decodeURIComponent(username) : null, currentUserIdPromise);
  if (!profile) return notFound();
  const { user, visibility, data } = profile;
  if (!username && user.username) redirect(`/app/profile/${user.username}`);

  return (
    <>
      {/*
        Structured data only for a profile a stranger can actually read.
        Describing a followers-only account to a crawler would be handing out
        exactly what its owner asked the app to withhold.
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
      <ProfileV2 data={data} />
    </>
  );
}
