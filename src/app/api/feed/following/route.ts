import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { NextResponse } from "next/server";
import { getBlockedUserIds } from "@/utils/blocks";

export const dynamic = "force-dynamic";

const SUPPLEMENT_THRESHOLD = 3;

/**
 * GET /api/feed/following — what people are saying, and what they've been watching.
 *
 * **This used to read one table and show only verbs.** Every row was a state
 * change — "ray · Watched · Plus Minus" — rendered as a coloured badge above a
 * poster. Nobody had said anything, so there was nothing to reply to, agree
 * with, or feel part of. You cannot join a room where no one is talking; you
 * can only watch a log scroll past.
 *
 * Measured on this database at the time of the change: **601 logged state
 * changes against 2 pieces of writing.** The feed was faithfully reflecting
 * that ratio. So the fix is not styling — it is reading the table where the
 * writing actually lives (`takes`, from migration 065, which this route had
 * never touched) and letting a sentence be the row.
 *
 * Two kinds of row now:
 *   - `take`  — somebody wrote something. A card. The text is the headline.
 *   - `watch` — somebody watched things. One quiet line per person, bundled.
 *
 * Verbs are not deleted, they are *subordinated*: collapsed to one line per
 * author and typographically demoted, so a person's evening of logging can
 * never bury a person's sentence.
 *
 * Works signed-out: an anonymous visitor has no follows, so they fall through
 * to the supplement and see public community activity.
 */

type Author = { id: string; username: string; avatarUrl: string | null };

type Title = {
  itemId: string;
  itemType: string;
  name: string | null;
  imageUrl: string | null;
};

type FeedRow = {
  /** Stable across pages; `kind:sourceId`. */
  key: string;
  kind: "take" | "watch";
  author: Author;
  createdAt: string;
  /** Present on `take` rows — the reason the row exists. */
  body?: string;
  score?: number | null;
  /** One for a take; up to four for a bundled watch line. */
  titles: Title[];
  /** Titles omitted from a bundle, so the line can say "and 3 more". */
  overflow?: number;
};

type ActivityRow = {
  id: number;
  user_id: string;
  activity_type: string;
  item_id: string | null;
  item_type: string | null;
  item_name: string | null;
  image_url: string | null;
  score: number | null;
  review_text: string | null;
  created_at: string;
};

type TakeRow = {
  user_id: string;
  item_id: string;
  item_type: string;
  body: string | null;
  score: number | null;
  created_at: string;
};

/** Watch lines from one author inside this window merge into one row. */
const BUNDLE_MS = 6 * 60 * 60 * 1000;
/** Titles named in a bundled watch line before it says "and N more". */
const BUNDLE_TITLES = 4;
/** No one author may own the page. */
const MAX_ROWS_PER_AUTHOR = 3;

/**
 * The cursor carries a timestamp plus the last `user_activity` id seen.
 *
 * A bare `created_at` cursor with a strict `<` silently drops rows sharing a
 * timestamp with the last row of a page, and migration 045 backfilled many
 * rows at identical timestamps, so this was not hypothetical.
 *
 * `takes` gets the timestamp alone: migration 065 gave it a composite primary
 * key (user_id, item_id, item_type, scope, …) and **no surrogate id**, so
 * there is no single column to break ties on. Acceptable because one person
 * cannot publish two takes on one title, which makes same-timestamp collisions
 * within a page vanishingly unlikely rather than routine.
 */
function parseCursor(raw: string | null) {
  if (!raw) return null;
  const [ts, a] = raw.split("|");
  if (!ts) return null;
  return { ts, activityId: Number(a) || 0 };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const viewerId = await getAuthUserId();

  const { searchParams } = new URL(request.url);
  const cursor = parseCursor(searchParams.get("cursor"));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));

  const { data: following } = viewerId
    ? await supabase.from("user_connections").select("followed_id").eq("follower_id", viewerId)
    : { data: null };

  const followedIds = following?.map((f) => f.followed_id) ?? [];

  // Follow almost nobody? Supplement so the feed is never empty.
  //
  // Rank by who has been active recently rather than who has the biggest
  // library, and include the viewer — before you follow anyone, your own
  // history is the only thing that makes the page feel alive.
  //
  // RLS on user_activity is profile_visible_to_viewer(user_id), so widening
  // the pool cannot expose a private profile's activity.
  let targetUserIds = [...followedIds];
  const isSupplemented = followedIds.length < SUPPLEMENT_THRESHOLD;

  if (isSupplemented) {
    if (viewerId && !targetUserIds.includes(viewerId)) targetUserIds.push(viewerId);

    const { data: recentActors } = await supabase
      .from("user_activity")
      .select("user_id")
      .order("created_at", { ascending: false })
      .limit(300);

    const seen = new Set(targetUserIds);
    for (const row of recentActors ?? []) {
      const id = String(row.user_id);
      if (seen.has(id)) continue;
      seen.add(id);
      targetUserIds.push(id);
      if (targetUserIds.length >= followedIds.length + 11) break;
    }
  }

  const blockedIds = await getBlockedUserIds(supabase, viewerId ?? null);
  if (blockedIds.size > 0) targetUserIds = targetUserIds.filter((id) => !blockedIds.has(id));

  const empty = {
    items: [] as FeedRow[],
    nextCursor: null,
    hasMore: false,
    followedCount: followedIds.length,
    isSupplemented,
    isSignedIn: Boolean(viewerId),
  };

  if (targetUserIds.length === 0) {
    return NextResponse.json(empty, { headers: { "Cache-Control": "private, no-store" } });
  }

  // Over-fetch both sources: collapsing means N raw rows yield fewer than N
  // displayed rows, so a `limit`-sized read would under-fill the page.
  const window = limit * 4;

  let activityQuery = supabase
    .from("user_activity")
    .select("id, user_id, activity_type, item_id, item_type, item_name, image_url, score, review_text, created_at")
    .in("user_id", targetUserIds)
    // `favored` is dropped: the CHECK constraint has allowed it since migration
    // 025 and no code has ever written one.
    .in("activity_type", ["watched", "started_watching", "rated", "reviewed"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(window);

  let takesQuery = supabase
    .from("takes")
    .select("user_id, item_id, item_type, body, score, created_at")
    .in("user_id", targetUserIds)
    // Only what its author chose to publish. RLS enforces this too; naming it
    // here means a policy change can never silently widen the feed.
    .eq("is_public", true)
    .eq("scope", "title")
    .not("body", "is", null)
    .order("created_at", { ascending: false })
    .limit(window);

  if (cursor) {
    activityQuery = activityQuery.or(
      `created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.activityId})`,
    );
    takesQuery = takesQuery.lt("created_at", cursor.ts);
  }

  const [{ data: activityData, error }, { data: takesData, error: takesError }] = await Promise.all([
    activityQuery,
    takesQuery,
  ]);

  // Both errors are surfaced. Checking only the first is how an earlier version
  // of this route selected a column `takes` does not have, got back nothing,
  // and rendered a feed with no voices in it while reporting success.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (takesError) return NextResponse.json({ error: takesError.message }, { status: 500 });

  const activity = (activityData ?? []) as ActivityRow[];
  const takes = (takesData ?? []) as TakeRow[];

  if (activity.length === 0 && takes.length === 0) {
    return NextResponse.json(empty, { headers: { "Cache-Control": "private, no-store" } });
  }

  const authorIds = [...new Set([...activity.map((r) => r.user_id), ...takes.map((r) => r.user_id)])];
  const { data: authorRows } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .in("id", authorIds);
  const authorById = new Map(
    (authorRows ?? []).map((a) => [
      a.id as string,
      { id: a.id as string, username: (a.username as string) ?? "user", avatarUrl: a.avatar_url as string | null },
    ]),
  );

  // `takes` stores no title or poster — it is keyed on a TMDB id and nothing
  // else — so the card's context strip is hydrated from the status table the
  // same user already wrote when they logged the title.
  const takeKeys = takes.map((t) => `${t.user_id}:${t.item_id}`);
  const { data: statusRows } = takeKeys.length
    ? await supabase
        .from("user_media_status")
        .select("user_id, item_id, item_name, image_url")
        .in("user_id", [...new Set(takes.map((t) => t.user_id))])
        .in("item_id", [...new Set(takes.map((t) => t.item_id))])
    : { data: [] };
  const titleByKey = new Map(
    (statusRows ?? []).map((r) => [
      `${r.user_id}:${r.item_id}`,
      { name: r.item_name as string | null, imageUrl: r.image_url as string | null },
    ]),
  );

  // ── Build rows ────────────────────────────────────────────────────────────
  const rows: FeedRow[] = [];
  /** `author:type:id` for every subject a take already speaks for. */
  const spokenFor = new Set<string>();

  for (const t of takes) {
    const author = authorById.get(t.user_id);
    const body = (t.body ?? "").trim();
    if (!author || !body) continue;
    const meta = titleByKey.get(`${t.user_id}:${t.item_id}`);
    spokenFor.add(`${t.user_id}:${t.item_type}:${t.item_id}`);
    rows.push({
      key: `take:${t.user_id}:${t.item_type}:${t.item_id}`,
      kind: "take",
      author,
      createdAt: t.created_at,
      body,
      score: t.score,
      titles: [
        {
          itemId: t.item_id,
          itemType: t.item_type,
          name: meta?.name ?? null,
          imageUrl: meta?.imageUrl ?? null,
        },
      ],
    });
  }

  // A written review already in user_activity is a voice too — it predates
  // `takes` and there is no reason to render it as a verb.
  for (const a of activity) {
    const author = authorById.get(a.user_id);
    const text = (a.review_text ?? "").trim();
    if (!author || !text || !a.item_id || !a.item_type) continue;
    const subject = `${a.user_id}:${a.item_type}:${a.item_id}`;
    if (spokenFor.has(subject)) continue; // the take supersedes it
    spokenFor.add(subject);
    rows.push({
      key: `activity:${a.id}`,
      kind: "take",
      author,
      createdAt: a.created_at,
      body: text,
      score: a.score,
      titles: [{ itemId: a.item_id, itemType: a.item_type, name: a.item_name, imageUrl: a.image_url }],
    });
  }

  // ── Watch lines, bundled ──────────────────────────────────────────────────
  //
  // The duplicate the owner saw ("Dhindora" twice, as Watched and as Started
  // Watching) has a precise cause: migration 051 deletes only the `watched`
  // row before inserting, while 040 inserts `started_watching` and nothing
  // ever removes it. Two triggers on two tables, neither aware of the other.
  // Collapsing per author per title fixes it at the point of display for every
  // row already in the table, including the ones those triggers wrote.
  const perAuthor = new Map<string, ActivityRow[]>();
  for (const a of activity) {
    if (!a.item_id || !a.item_type) continue;
    if ((a.review_text ?? "").trim()) continue; // already emitted as a voice
    if (spokenFor.has(`${a.user_id}:${a.item_type}:${a.item_id}`)) continue;
    const list = perAuthor.get(a.user_id) ?? [];
    list.push(a);
    perAuthor.set(a.user_id, list);
  }

  for (const [userId, list] of perAuthor) {
    const author = authorById.get(userId);
    if (!author) continue;

    // One entry per title, newest wins — this is what collapses
    // watched + started_watching into a single mention.
    const byTitle = new Map<string, ActivityRow>();
    for (const a of list) {
      const k = `${a.item_type}:${a.item_id}`;
      const prev = byTitle.get(k);
      if (!prev || a.created_at > prev.created_at) byTitle.set(k, a);
    }

    const ordered = [...byTitle.values()].sort((x, y) => y.created_at.localeCompare(x.created_at));
    let bundle: ActivityRow[] = [];
    const flush = () => {
      if (bundle.length === 0) return;
      const titles = bundle.slice(0, BUNDLE_TITLES).map((a) => ({
        itemId: a.item_id!,
        itemType: a.item_type!,
        name: a.item_name,
        imageUrl: a.image_url,
      }));
      rows.push({
        key: `watch:${userId}:${bundle[0].id}`,
        kind: "watch",
        author,
        createdAt: bundle[0].created_at,
        titles,
        overflow: Math.max(0, bundle.length - BUNDLE_TITLES),
      });
      bundle = [];
    };

    for (const a of ordered) {
      if (
        bundle.length > 0 &&
        new Date(bundle[bundle.length - 1].created_at).getTime() - new Date(a.created_at).getTime() >
          BUNDLE_MS
      ) {
        flush();
      }
      bundle.push(a);
    }
    flush();
  }

  // ── Order, cap, slice ─────────────────────────────────────────────────────
  // Voices first, then chronology within each kind.
  //
  // Strict reverse-chronological ordering sounds neutral and is not. Measured
  // on this database: 601 logged state changes against 2 pieces of writing.
  // At that ratio, sorting by time alone buries every sentence anyone writes
  // under a wall of logging, permanently — the one person who said something
  // lands at the bottom of the page behind two lines of "ray watched…".
  //
  // A watch line is context, not news; it does not go stale the way a remark
  // does, and nothing is lost by letting it sit below. This is the same
  // hierarchy the row components already express typographically — a take is a
  // card, a watch is a quiet line — applied to order as well as to weight.
  /**
   * Pagination order is time, and only time.
   *
   * The kind-first sort used to be global: every take in the fetched window was
   * ranked ahead of every watch line regardless of when either happened. That
   * cannot coexist with a timestamp cursor. `consumedUpTo` was taken from the
   * last *rendered* row, and the next request filters `created_at < that` — so
   * an author whose three kept rows were old takes had their newer watch lines
   * sitting past the page boundary with `created_at > consumedUpTo`, and the
   * `lt` filter excluded them from every subsequent page. Permanently, with no
   * sequence of requests that could reach them.
   *
   * So the two orders are separated: a total order by time for paging, and the
   * kind ranking applied to the page for display, below. Writing still rises
   * above logging in what the reader sees; it just no longer decides which rows
   * the cursor has passed.
   */
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.key.localeCompare(b.key));

  /**
   * Walk in time order, capping per author, and remember how far we LOOKED —
   * not how far we rendered.
   *
   * A capped row is consumed: it was considered for this page and deliberately
   * not shown, so the cursor has to move past it or the next page returns it
   * again forever. With three users on the platform, one person's evening would
   * otherwise be the entire page — the cap is per page, so the same author is
   * free to appear again further down the timeline.
   */
  const perAuthorCount = new Map<string, number>();
  const page: FeedRow[] = [];
  const overflow: FeedRow[] = [];
  let examined = 0;
  for (const r of rows) {
    if (page.length >= limit) break;
    examined++;
    const n = perAuthorCount.get(r.author.id) ?? 0;
    if (n >= MAX_ROWS_PER_AUTHOR) {
      overflow.push(r);
      continue;
    }
    perAuthorCount.set(r.author.id, n + 1);
    page.push(r);
  }

  /**
   * A short page takes its capped-out rows back.
   *
   * The cap exists so one author cannot own the page, not so that content
   * disappears. If everyone else put together did not fill `limit`, holding
   * these back serves nobody: they are already behind the cursor, so refusing
   * them here is refusing them for good. It also stops the client asking for
   * another page and getting a nearly empty one.
   *
   * A page that filled without them still drops them, which is the cap doing
   * the job it was written for.
   */
  if (page.length < limit && overflow.length > 0) {
    page.push(...overflow.slice(0, limit - page.length));
  }

  // Everything at or after this has been considered. Rows the cap dropped are
  // behind it, which is what makes advancing the cursor safe.
  const consumedUpTo = examined > 0 ? rows[examined - 1].createdAt : null;
  const hasMore =
    examined < rows.length || activity.length >= window || takes.length >= window;

  const lastActivityId =
    activity.filter((a) => !consumedUpTo || a.created_at >= consumedUpTo).at(-1)?.id ?? 0;

  // Presentation only: a take is a card, a watch is a quiet line, and the one
  // person who said something should not land beneath two lines of logging.
  // This reorders the page; it does not decide what is on it.
  const kindRank = (k: FeedRow["kind"]) => (k === "take" ? 0 : 1);
  const items = [...page].sort(
    (a, b) =>
      kindRank(a.kind) - kindRank(b.kind) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.key.localeCompare(b.key),
  );

  return NextResponse.json(
    {
      items,
      nextCursor: consumedUpTo ? `${consumedUpTo}|${lastActivityId}` : null,
      hasMore,
      followedCount: followedIds.length,
      isSupplemented,
      isSignedIn: Boolean(viewerId),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
