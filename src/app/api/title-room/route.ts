import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { getBlockedUserIds } from "@/utils/blocks";

export const dynamic = "force-dynamic";

/**
 * GET /api/title-room?itemId=&itemType= — everyone who is in the room with you
 * on one title, in one response.
 *
 * ── Why this route exists ───────────────────────────────────────────────────
 * The find-people half of a title page was four components making four round
 * trips — /api/friends-watched, /api/title-audience, /api/rating-distribution,
 * and TitleTalk's own — over the same three tables. Every one of them paid its
 * own auth check and its own `user_ratings` scan for the same item, and none of
 * them could see what the others had learned. The rating scan in particular is
 * read twice here for two different answers (the histogram *and* who rated it
 * highly), which is only possible once the work happens in one place.
 *
 * ── The part that is new ────────────────────────────────────────────────────
 * `discover` — people the viewer does NOT follow who rated this title highly.
 * A title page is the most natural place in this app to meet someone: you
 * already know you have something in common with everyone on it. Until now the
 * page spent that entirely on people you had already found.
 *
 * ── Privacy ─────────────────────────────────────────────────────────────────
 * Three gates, and they are not interchangeable:
 *
 * 1. RLS does the first pass. `user_ratings` and `user_media_status` are both
 *    `auth.uid() = user_id OR profile_visible_to_viewer(user_id)` (019, 029),
 *    so a profile the viewer cannot see never reaches this code at all.
 * 2. `profile_show_ratings` governs the *number*, and it is applied differently
 *    to the two lists on purpose — see `following` and `discover` below.
 * 3. Blocks are enforced at the RLS layer for writes only (042). Read paths
 *    filter them here, via the shared helper.
 *
 * Private takes are never selected: the `takes` query filters on `is_public`
 * explicitly rather than trusting the read policy, for the reason 065 spells
 * out — RLS filters rows, not columns, and a route that selects by id alone
 * would eventually hand back a private one.
 */

/** 8/10 is 4★. The same threshold 043 uses to weight a rating as real interest. */
const HIGH_SCORE = 8;

/** Rendered strangers. Five matches `title_audience`'s sample, and fits a column. */
const DISCOVER_LIMIT = 5;

/**
 * Candidates ranked before profiles are fetched. The gates below can reject
 * some, so the pool carries enough slack to still fill DISCOVER_LIMIT — but
 * not so much that a popular title turns into a hundred-profile lookup.
 */
const DISCOVER_POOL = 24;

const FOLLOWING_LIMIT = 12;

type Status = "watchlist" | "watching" | "watched" | "on_hold" | "dropped";

type Person = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: Status | null;
  score: number | null;
  /**
   * That they rated it, which is not the same fact as `score`.
   *
   * `profile_show_ratings` hides the number, not the act — the title still
   * appears on their profile either way, and /api/friends-watched has always
   * labelled them "Rated". Without this the UI has no way to say what someone
   * who opted out actually did, and prints a blank line under their name.
   */
  rated: boolean;
  /** Whether they posted a public take. The text itself lives in the thread. */
  hasNote: boolean;
  /** Drives the follow control on discover rows. */
  followState: "following" | "pending" | "follow";
  visibility: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  visibility: string | null;
  profile_show_ratings: boolean | null;
};

/** 018 and 066 both read it this way: null means public, and case/space vary. */
function isPublicProfile(visibility: string | null | undefined): boolean {
  return String(visibility ?? "public").toLowerCase().trim() === "public";
}

/**
 * Where a followed person sits in the list.
 *
 * Having seen it outranks planning to, and a bare rating with no lifecycle row
 * still means they saw it — so it sorts among the watchers rather than at the
 * bottom with the watchlist.
 */
const STATUS_RANK: Record<Status, number> = {
  watched: 0,
  watching: 2,
  on_hold: 3,
  dropped: 4,
  watchlist: 5,
};

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId")?.trim();
  const itemType = req.nextUrl.searchParams.get("itemType") === "tv" ? "tv" : "movie";
  if (!itemId) return jsonError("itemId is required", 400);

  const supabase = await createClient();
  const viewerId = await getAuthUserId();

  // ── Phase 1: everything that depends only on the title ─────────────────────
  const [ratingsRes, audienceRes, followedIds, takeRows, blocked] = await Promise.all([
    supabase
      .from("user_ratings")
      .select("user_id, score")
      .eq("item_id", itemId)
      .eq("item_type", itemType),

    supabase.rpc("title_audience", {
      p_item_id: itemId,
      p_item_type: itemType,
      p_viewer: viewerId ?? null,
    }),

    (async (): Promise<string[]> => {
      if (!viewerId) return [];
      const { data } = await supabase
        .from("user_connections")
        .select("followed_id")
        .eq("follower_id", viewerId);
      return ((data ?? []) as { followed_id: string }[]).map((r) => r.followed_id);
    })(),

    (async () => {
      const { data } = await supabase
        .from("takes")
        .select("user_id, body")
        .eq("item_id", itemId)
        .eq("item_type", itemType)
        .eq("scope", "title")
        .eq("season_number", -1)
        .eq("episode_number", -1)
        .eq("is_public", true)
        .not("body", "is", null)
        .order("updated_at", { ascending: false })
        .limit(200);
      return (data ?? []) as { user_id: string; body: string | null }[];
    })(),

    getBlockedUserIds(supabase, viewerId),
  ]);

  const ratingRows = (ratingsRes.data ?? []) as { user_id: string; score: number }[];

  // One scan, two answers: the histogram everyone sees, and the score attached
  // to each person below it.
  const histogram = Array.from({ length: 10 }, () => 0);
  const scoreOf = new Map<string, number>();
  let sum = 0;
  let total = 0;
  for (const r of ratingRows) {
    if (!Number.isInteger(r.score) || r.score < 1 || r.score > 10) continue;
    histogram[r.score - 1] += 1;
    scoreOf.set(r.user_id, r.score);
    sum += r.score;
    total += 1;
  }

  const writers = new Set<string>();
  for (const t of takeRows) {
    if ((t.body ?? "").trim()) writers.add(t.user_id);
  }

  const followedSet = new Set(followedIds);

  /**
   * Strangers worth meeting, ranked before we know anything about their
   * profiles. Writing about it comes ahead of a higher score: a 10 with nothing
   * beside it says less about a person than an 8 they took the trouble to
   * explain, and the explanation is already on the page to read.
   */
  const discoverPool = ratingRows
    .filter(
      (r) =>
        // Same bounds the histogram applies, so a row the chart refused to
        // count can never be the thing that recommends a person.
        r.score >= HIGH_SCORE &&
        r.score <= 10 &&
        r.user_id !== viewerId &&
        !followedSet.has(r.user_id) &&
        !blocked.has(r.user_id),
    )
    .sort(
      (a, b) =>
        Number(writers.has(b.user_id)) - Number(writers.has(a.user_id)) ||
        b.score - a.score ||
        a.user_id.localeCompare(b.user_id),
    )
    .slice(0, DISCOVER_POOL);

  const discoverIds = discoverPool.map((r) => r.user_id);

  /**
   * The people worth asking the database about: everyone the viewer follows,
   * plus the shortlist above, plus the viewer.
   *
   * Scoped by id rather than by item because a follow list is small and a
   * popular title's audience is not. /api/friends-watched already filtered this
   * way; the difference is that here the same id list serves three queries
   * instead of being rebuilt per widget.
   */
  const lookupIds = Array.from(
    new Set<string>([...followedIds, ...discoverIds, ...(viewerId ? [viewerId] : [])]),
  );

  // ── Phase 2: the people ────────────────────────────────────────────────────
  const [statusRows, profileRows, pendingIds] = await Promise.all([
    (async () => {
      if (lookupIds.length === 0) return [] as { user_id: string; status: Status }[];
      const { data } = await supabase
        .from("user_media_status")
        .select("user_id, status")
        .eq("item_id", itemId)
        .eq("item_type", itemType)
        .in("user_id", lookupIds);
      return (data ?? []) as { user_id: string; status: Status }[];
    })(),

    (async () => {
      if (lookupIds.length === 0) return [] as ProfileRow[];
      const { data } = await supabase
        .from("users")
        .select("id, username, avatar_url, visibility, profile_show_ratings")
        .in("id", lookupIds);
      return (data ?? []) as ProfileRow[];
    })(),

    /**
     * Follow requests the viewer has already sent to people on the shortlist.
     * Resolved here so the buttons render in their true state on first paint —
     * FollowButton will otherwise ask for itself, once per card.
     */
    (async (): Promise<Set<string>> => {
      if (!viewerId || discoverIds.length === 0) return new Set();
      const { data } = await supabase
        .from("user_follow_requests")
        .select("receiver_id")
        .eq("sender_id", viewerId)
        .eq("status", "pending")
        .in("receiver_id", discoverIds);
      return new Set(((data ?? []) as { receiver_id: string }[]).map((r) => r.receiver_id));
    })(),
  ]);

  const statusOf = new Map(statusRows.map((r) => [r.user_id, r.status]));
  const profileOf = new Map(profileRows.map((p) => [p.id, p]));

  // ── The people you already found ───────────────────────────────────────────
  const following: Person[] = [];
  for (const uid of followedIds) {
    if (blocked.has(uid)) continue;

    const status = statusOf.get(uid) ?? null;
    const score = scoreOf.get(uid) ?? null;
    const hasNote = writers.has(uid);
    // Following someone is not itself news about this title.
    if (!status && score === null && !hasNote) continue;

    const profile = profileOf.get(uid);
    if (!profile?.username) continue;

    following.push({
      userId: uid,
      username: profile.username,
      avatarUrl: profile.avatar_url ?? null,
      status,
      /**
       * The person stays, the number goes. `profile_show_ratings` hides scores
       * from visitors on the profile grid (UserWatchedPagination), and a title
       * page is a visitor's view of the same thing — but it governs the score
       * alone, so someone who has opted out still counts as present here.
       */
      score: profile.profile_show_ratings === false ? null : score,
      rated: score !== null,
      hasNote,
      followState: "following",
      visibility: String(profile.visibility ?? "public"),
    });
  }

  following.sort((a, b) => {
    // `rated`, not `score` — otherwise hiding the number also demotes the
    // person to the bottom of the list, which is a second consequence nobody
    // opted into when they turned the toggle off.
    const rank = (p: Person) =>
      p.status ? STATUS_RANK[p.status] : p.rated || p.hasNote ? 1 : 6;
    return (
      rank(a) - rank(b) ||
      Number(b.hasNote) - Number(a.hasNote) ||
      (b.score ?? -1) - (a.score ?? -1) ||
      a.username.localeCompare(b.username)
    );
  });

  // ── The people you have not ────────────────────────────────────────────────
  const discover: Person[] = [];
  for (const candidate of discoverPool) {
    if (discover.length >= DISCOVER_LIMIT) break;

    const profile = profileOf.get(candidate.user_id);
    if (!profile?.username) continue;

    /**
     * A stranger has to be publicly visible to be offered as one. RLS already
     * admitted only profiles this viewer can see, which for someone they do not
     * follow means public — this is the explicit second reading of the same
     * rule, because the cost of it being wrong is a followers-only profile
     * shown to someone who was never let in.
     */
    if (!isPublicProfile(profile.visibility)) continue;

    /**
     * Unlike the list above, opting out of showing ratings removes the person
     * entirely rather than blanking the number. Their score is the whole reason
     * they would appear — being listed under "rated this highly" publishes it
     * whether or not the digit is printed.
     */
    if (profile.profile_show_ratings === false) continue;

    discover.push({
      userId: candidate.user_id,
      username: profile.username,
      avatarUrl: profile.avatar_url ?? null,
      status: statusOf.get(candidate.user_id) ?? null,
      score: candidate.score,
      rated: true,
      hasNote: writers.has(candidate.user_id),
      followState: pendingIds.has(candidate.user_id) ? "pending" : "follow",
      visibility: String(profile.visibility ?? "public"),
    });
  }

  // Degrades to zero rather than 500 — 048 may not be applied everywhere, and
  // the rest of this response is still worth rendering without it.
  if (audienceRes.error) console.error("title_audience:", audienceRes.error);
  const audienceRow = Array.isArray(audienceRes.data) ? audienceRes.data[0] : audienceRes.data;

  const viewerStatus = viewerId ? (statusOf.get(viewerId) ?? null) : null;
  const viewerScore = viewerId ? (scoreOf.get(viewerId) ?? null) : null;

  return jsonSuccess({
    /** Handed to the follow control so it needs no auth round trip of its own. */
    viewerId,
    viewerScore,
    viewerHasSeen:
      viewerStatus === "watched" || viewerStatus === "watching" || viewerScore !== null,
    audience: {
      watchers: Number(audienceRow?.viewers ?? 0),
      communityUsers: Number(audienceRow?.total_users ?? 0),
      sample: (audienceRow?.sample ?? []) as {
        userId: string;
        username: string;
        avatarUrl: string | null;
      }[],
    },
    ratings: {
      total,
      average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
      distribution: histogram.map((count, i) => ({
        score: i + 1,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      })),
    },
    following: following.slice(0, FOLLOWING_LIMIT),
    followingTotal: following.length,
    discover,
  });
}
