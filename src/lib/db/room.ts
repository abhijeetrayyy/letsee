/**
 * Everyone who is in the room with you on one title.
 *
 * ── What this is ───────────────────────────────────────────────────────────
 * `/api/title-room` consolidated four widgets that were each making their own
 * round trip over the same three tables — `/api/friends-watched`,
 * `/api/title-audience`, `/api/rating-distribution` and TitleTalk's own. That
 * consolidation was right and is kept here verbatim; what changes is where it
 * runs. Every query below is `from()` or `rpc()`, every RPC is granted EXECUTE
 * to `anon` and `authenticated`, and the assembly in between is arithmetic.
 * None of it needed a server, and it ran on every movie and series page view.
 *
 * ── Privacy ────────────────────────────────────────────────────────────────
 * Three gates, and they are not interchangeable:
 *
 * 1. RLS does the first pass. `user_ratings` and `user_media_status` are both
 *    `auth.uid() = user_id OR profile_visible_to_viewer(user_id)` (019, 029),
 *    so a profile the viewer cannot see never reaches this code. That is true
 *    of a browser holding the anon key exactly as it was of a cookie client on
 *    a function — the policy is evaluated in Postgres against the caller's JWT,
 *    and moving the caller does not move the check.
 * 2. `profile_show_ratings` governs the *number*, and it is applied differently
 *    to the two lists on purpose — see `following` and `discover` below.
 * 3. Blocks are enforced at the RLS layer for writes only (042). Read paths
 *    filter them here.
 *
 * Private takes are never selected: the `takes` query filters on `is_public`
 * explicitly rather than trusting the read policy, for the reason 065 spells
 * out — RLS filters rows, not columns.
 */

import { supabase } from "@/utils/supabase/client";
import { getBlockedUserIds } from "@/utils/blocks";

/** 8/10 is 4★. The same threshold 043 uses to weight a rating as real interest. */
const HIGH_SCORE = 8;

/** Rendered strangers. Five matches `title_audience`'s sample, and fits a column. */
const DISCOVER_LIMIT = 5;

/**
 * Candidates ranked before profiles are fetched. The gates below can reject
 * some, so the pool carries enough slack to still fill DISCOVER_LIMIT — but not
 * so much that a popular title turns into a hundred-profile lookup.
 */
const DISCOVER_POOL = 24;

const FOLLOWING_LIMIT = 12;

type Status = "watchlist" | "watching" | "watched" | "on_hold" | "dropped";

export type Person = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: Status | null;
  score: number | null;
  /**
   * That they rated it, which is not the same fact as `score`.
   * `profile_show_ratings` hides the number, not the act.
   */
  rated: boolean;
  /** Whether they posted a public take. The text itself lives in the thread. */
  hasNote: boolean;
  /** Drives the follow control on discover rows. */
  followState: "following" | "pending" | "follow";
  visibility: string;
};

export type Room = {
  viewerId: string | null;
  viewerScore: number | null;
  viewerHasSeen: boolean;
  audience: {
    watchers: number;
    communityUsers: number;
    sample: { userId: string; username: string; avatarUrl: string | null }[];
  };
  ratings: {
    total: number;
    average: number;
    distribution: { score: number; count: number; percentage: number }[];
  };
  following: Person[];
  followingTotal: number;
  discover: Person[];
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

export async function fetchTitleRoom(
  rawItemId: string | number,
  rawItemType: string,
  viewerId: string | null,
): Promise<Room> {
  const itemId = String(rawItemId).trim();
  const itemType = rawItemType === "tv" ? "tv" : "movie";

  // ── Phase 1: everything that depends only on the title ────────────────────
  const [ratingsRes, audienceRes, histogramRes, followedIds, takeRows, blocked] =
    await Promise.all([
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

      /**
       * The histogram comes from a SECURITY DEFINER aggregate, not from the
       * rows above.
       *
       * `user_ratings_select_profile_visible` (019) gates SELECT on profile
       * visibility, which is right for anything naming a person and wrong for a
       * number naming nobody: a private profile's score vanished from every
       * average it belonged to. Same table, two reads, two different rules.
       */
      supabase.rpc("title_rating_histogram", {
        p_item_id: itemId,
        p_item_type: itemType,
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

  // The per-person scores, for the lists that name people.
  const scoreOf = new Map<string, number>();
  for (const r of ratingRows) {
    if (!Number.isInteger(r.score) || r.score < 1 || r.score > 10) continue;
    scoreOf.set(r.user_id, r.score);
  }

  const histogram = Array.from({ length: 10 }, () => 0);
  let sum = 0;
  let total = 0;

  const aggregate = (histogramRes.data ?? []) as { score: number; count: number }[];
  if (aggregate.length > 0) {
    for (const bucket of aggregate) {
      if (!Number.isInteger(bucket.score) || bucket.score < 1 || bucket.score > 10) continue;
      const n = Number(bucket.count) || 0;
      histogram[bucket.score - 1] = n;
      sum += bucket.score * n;
      total += n;
    }
  } else {
    /**
     * The pre-067 behaviour, kept as a fallback rather than a hard dependency.
     * If the function is not deployed the chart is still drawn — from the rows
     * RLS allows, which undercounts private raters exactly as it always did,
     * rather than rendering an empty chart on a rated title.
     */
    for (const r of ratingRows) {
      if (!Number.isInteger(r.score) || r.score < 1 || r.score > 10) continue;
      histogram[r.score - 1] += 1;
      sum += r.score;
      total += 1;
    }
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
   * plus the shortlist above, plus the viewer. Scoped by id rather than by
   * item because a follow list is small and a popular title's audience is not.
   */
  const lookupIds = Array.from(
    new Set<string>([...followedIds, ...discoverIds, ...(viewerId ? [viewerId] : [])]),
  );

  // ── Phase 2: the people ───────────────────────────────────────────────────
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
     * Follow requests the viewer has already sent to people on the shortlist,
     * resolved here so the buttons render in their true state on first paint —
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

  // ── The people you already found ──────────────────────────────────────────
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
       * The person stays, the number goes. `profile_show_ratings` governs the
       * score alone, so someone who has opted out still counts as present here.
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

  // ── The people you have not ───────────────────────────────────────────────
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

  // Degrades to zero rather than throwing — 048 may not be applied everywhere,
  // and the rest of this answer is still worth rendering without it.
  if (audienceRes.error) console.error("title_audience:", audienceRes.error);
  const audienceRow = Array.isArray(audienceRes.data) ? audienceRes.data[0] : audienceRes.data;

  const viewerStatus = viewerId ? (statusOf.get(viewerId) ?? null) : null;
  const viewerScore = viewerId ? (scoreOf.get(viewerId) ?? null) : null;

  return {
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
  };
}
