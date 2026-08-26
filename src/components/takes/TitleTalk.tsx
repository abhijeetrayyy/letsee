"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import Link from "@components/ui/AppLink";
import { Loader2, Lock, Send, Trash2, X } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import StarRating from "@components/ui/StarRating";
import { formatStars } from "@/utils/ratingScale";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { supabase } from "@/utils/supabase/client";
import {
  deleteMyTake,
  fetchTakesForTitle,
  saveMyTake,
  type TakeIdentity,
} from "@/lib/db/takes";
import {
  deleteComment,
  fetchComments,
  postComment,
  type CommentRow,
} from "@/lib/db/comments";
import { NA } from "@/utils/takes";
import { roomKey, takesKey as buildTakesKey, commentsKey as buildCommentsKey } from "@/lib/db/keys";
import { useInView } from "@/hooks/useInView";

/**
 * One composer, one thread.
 *
 * The detail page used to carry two boxes: "Your take" and, further down,
 * "Discussion". That asked the reader to decide *which box a thought belongs
 * in before they had finished having it* — and the honest answer was often
 * "both", or "I don't know", which resolves to writing nothing. Labelling the
 * two boxes more clearly does not fix it, because the problem is the fork, not
 * the signage.
 *
 * So there is one place to type. What you write is yours until you say
 * otherwise; if you post it, it becomes the first thing you said in the thread
 * and other people can answer it. Private and public stop being two
 * destinations and become one decision about one piece of writing — which is
 * what D1 set out to do and stopped one step short of.
 */

type Mine = { score: number | null; body: string | null; isPublic: boolean } | null;
type Other = {
  username: string;
  avatarUrl: string | null;
  score: number | null;
  body: string;
  updatedAt: string;
};
/**
 * The prompt is the single highest-leverage thing on this component.
 *
 * A blank textarea asks you to *generate* something against a standard nobody
 * states, which is why most people close it. A question asks you to *complete*
 * something — and these questions are all about memory and feeling rather than
 * craft, because craft invites the comparison that stops people writing.
 * Nobody can be wrong about what stayed with them.
 *
 * Chosen by title id rather than at random so it does not change under you
 * between renders.
 */
const PROMPTS = [
  "What stayed with you?",
  "What did it remind you of?",
  "Who did you watch it with?",
  "What were you expecting?",
  "Which bit are you still thinking about?",
  "How did it leave you feeling?",
];

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TitleTalk({
  itemId,
  itemType,
  scope = "title",
  seasonNumber,
  episodeNumber,
  itemName,
  imageUrl,
  genres,
  isAuthenticated: isAuthenticatedProp,
}: {
  itemId: string;
  itemType: "movie" | "tv";
  /** A series, one of its seasons, or one episode — the same three D1 defined. */
  scope?: "title" | "season" | "episode";
  seasonNumber?: number;
  episodeNumber?: number;
  itemName?: string;
  imageUrl?: string | null;
  genres?: string[];
  /**
   * Optional, and the fallback is the point.
   *
   * The two detail pages render this from inside a client component and
   * already hold the answer, so they pass it. The season and episode pages
   * render it from a *server* component — and computing this prop there meant
   * a `supabase.auth.getUser()` in the render, which is a session read, which
   * is what made both of those pages uncacheable and had them rebuilding from
   * scratch on every crawler hit.
   *
   * The provider below is mounted on `/app` in `app/app/layout.tsx`, so it
   * covers every caller. Reading it here costs one context lookup that has
   * already happened; reading it on the server cost the whole page its cache.
   */
  isAuthenticated?: boolean;
}) {
  // `comments` is keyed on its own id space, and a season or an episode needs a
  // composite id so two seasons of one show don't share a thread.
  const commentsItemType = scope === "title" ? itemType : scope;
  const commentsItemId =
    scope === "title"
      ? itemId
      : scope === "season"
        ? `${itemId}-s${seasonNumber}`
        : `${itemId}-s${seasonNumber}-e${episodeNumber}`;

  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  /**
   * The identity of the thing being talked about, in the shape `takes` stores.
   *
   * `NA` is -1 and means "not applicable at this scope" — not 0, because season
   * 0 is specials. It matches the `takes_scope_shape` constraint, so building
   * it here rather than serialising into a query string means a malformed
   * identity is a type error instead of a 400 at runtime.
   */
  const identity = useMemo<TakeIdentity>(
    () => ({
      itemId: String(itemId),
      itemType,
      scope,
      seasonNumber: scope === "title" ? NA : (seasonNumber ?? NA),
      episodeNumber: scope === "episode" ? (episodeNumber ?? NA) : NA,
    }),
    [itemId, itemType, scope, seasonNumber, episodeNumber],
  );

  const takesKey = buildTakesKey(
    identity.itemId,
    identity.itemType,
    identity.scope,
    identity.seasonNumber,
    identity.episodeNumber,
    viewerId,
  );
  const commentsKey = buildCommentsKey(commentsItemId, commentsItemType, viewerId);

  /**
   * Nothing is fetched until this section is approached.
   *
   * The composer and the thread sit below the synopsis, the cast row and the
   * trailers on every detail page. Two queries each, on every page view,
   * whether or not anyone scrolls that far — and the answer for most titles is
   * an empty thread and no take, which is a round trip to be told nothing has
   * happened.
   */
  const { ref, inView } = useInView<HTMLElement>();

  const {
    data: takes,
    mutate: mutateTakes,
    isLoading,
  } = useSWR(inView ? takesKey : null, () => fetchTakesForTitle(identity, viewerId));
  const { data: comments, mutate: mutateComments } = useSWR<CommentRow[]>(
    inView ? commentsKey : null,
    () => fetchComments(commentsItemId, commentsItemType, viewerId),
  );

  /**
   * ── When a thread earns a websocket ───────────────────────────────────────
   * The first version of this subscribed on mount, which meant a realtime
   * channel per visitor per title page — thousands of sockets held open to
   * watch threads that are empty and will stay empty for the length of the
   * visit. Realtime is metered by concurrent connections, so that is a bill for
   * watching nothing happen, and it is exactly the resource this app should not
   * be spending by default.
   *
   * A live thread is worth it when there is a conversation to be live *about*:
   * somebody has already written something, or the viewer just did and is
   * plausibly waiting for an answer. Otherwise the thread refreshes when this
   * section is scrolled to, when the viewer posts, and when the tab is focused,
   * which is what SWR already does for free.
   *
   * `comments` is in the publication as of migration 087.
   */
  const [participating, setParticipating] = useState(false);
  const conversationLive = inView && !!viewerId && ((comments?.length ?? 0) > 0 || participating);

  useEffect(() => {
    if (!conversationLive) return;
    const channel = supabase
      .channel(`thread-${commentsItemType}-${commentsItemId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `item_id=eq.${commentsItemId}`,
        },
        () => void mutateComments(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationLive, commentsItemId, commentsItemType, mutateComments]);

  const { refresh: refreshInteractions, isAuthenticated: isAuthenticatedFromContext } =
    useMediaInteraction();
  // The prop wins when a caller passes one — see the note on it above.
  const isAuthenticated = isAuthenticatedProp ?? isAuthenticatedFromContext;

  /**
   * TheRoom sits directly below this composer on the movie and TV pages and is
   * fed by a completely separate SWR key, so rating a title here left the panel
   * eight hundred pixels down still showing the old average, the old "N people
   * rated this", and `viewerScore: null` — its audience sentence even subtracts
   * the viewer's own vote, so the arithmetic was wrong too. The key is
   * reconstructible from props, and mutating it when TheRoom is not mounted
   * (season and episode scopes) is a harmless no-op.
   *
   * The provider refresh is the other half: the star widgets on cards read
   * their score from MediaInteractionProvider, which this path never touched.
   */
  const refreshRoom = async () => {
    await Promise.all([
      globalMutate(roomKey(itemId, itemType)),
      refreshInteractions(),
    ]).catch(() => {});
  };

  const mine = takes?.mine ?? null;
  const [draft, setDraft] = useState<string | null>(null);
  /**
   * In-flight score only — `undefined` means "nothing pending, read the server".
   *
   * It cannot be `number | null` with null meaning "not editing", because null
   * is also a real value now: it is what clearing a rating sends.
   */
  const [pending, setPending] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  // `null` means "not editing" — fall back to whatever is saved.
  const text = draft ?? mine?.body ?? "";
  const rating = pending !== undefined ? pending : (mine?.score ?? null);
  /**
   * Prose only. The score is no longer a draft — it commits on tap — so
   * counting it here would leave a card that has finished saving looking like
   * it still had unsaved work in it.
   */
  const dirty = draft !== null;

  const prompt = useMemo(() => {
    const seed = Math.abs(Number(itemId) || 0) + (seasonNumber ?? 0) * 7 + (episodeNumber ?? 0);
    return PROMPTS[seed % PROMPTS.length];
  }, [itemId, seasonNumber, episodeNumber]);

  const save = async (isPublic: boolean) => {
    if (!text.trim() && rating == null) return;
    if (!viewerId) return;
    setBusy(true);
    setError(null);
    try {
      /**
       * Straight to Postgres, through the same `saveTake` the route called.
       *
       * The rules that make this hard — a visibility change has to MOVE the
       * take rather than insert a second row beside it, the legacy mirror onto
       * `user_ratings` and `watched_items`, the diary note going through
       * `set_my_diary_notes` because 076 revoked SELECT on `review_text` — all
       * live in `@/utils/takes` and are called, not re-implemented. What is
       * gone is the Vercel function that used to sit in front of them holding
       * a Supabase client of a different type.
       */
      const message = await saveMyTake(viewerId, identity, {
        score: rating,
        body: text,
        isPublic,
        itemName,
        imageUrl,
        genres,
      });
      if (message) throw new Error(message);
      setDraft(null);
      setPending(undefined);
      await mutateTakes();
      await refreshRoom();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * A rating commits on tap. One gesture is the whole act.
   *
   * It deliberately sends `mine?.body`, never the live `draft`: tapping a star
   * must not quietly commit prose the writer has not decided about yet. The two
   * controls in this card do genuinely different things, and this is the line
   * between them.
   *
   * `isPublic` echoes whatever the existing take already is, so rating never
   * changes the visibility of writing that is already there.
   */
  const saveScore = async (next: number | null) => {
    if (!viewerId) return;
    setPending(next);
    setBusy(true);
    setError(null);
    try {
      /**
       * Clearing the last rating is a delete, not a save.
       *
       * `saveTake` rejects a take with no score and no body — it is the
       * `takes_not_empty` constraint stated in a message — so the PUT route
       * routed that case to the delete handler instead. That routing was in the
       * route, which meant it disappeared the moment the client called
       * `saveTake` directly: clearing the only star on a title with no writing
       * would have surfaced "Nothing to save." to somebody who had just asked
       * for exactly that.
       */
      const body = mine?.body ?? "";
      const isPublic = mine?.isPublic ?? false;
      const message =
        next === null && !body.trim()
          ? await deleteMyTake(viewerId, identity, isPublic)
          : await saveMyTake(viewerId, identity, {
              score: next,
              body,
              isPublic,
              itemName,
              imageUrl,
              genres,
            });
      if (message) throw new Error(message);
      await mutateTakes();
      await refreshRoom();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // Either way, stop overriding the server — on success it now agrees, and
      // on failure the stars must snap back rather than lie about being saved.
      setPending(undefined);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!viewerId) return;
    setBusy(true);
    setError(null);
    try {
      const message = await deleteMyTake(viewerId, identity, mine?.isPublic ?? false);
      if (message) {
        setError(message);
        return;
      }
      setDraft(null);
      setPending(undefined);
      await mutateTakes();
      await refreshRoom();
    } finally {
      setBusy(false);
    }
  };

  const postReply = async () => {
    const body = reply.trim();
    if (!body || !viewerId) return;
    setBusy(true);
    setReplyError(null);
    try {
      const message = await postComment(viewerId, commentsItemId, commentsItemType, body);
      if (message) {
        // A failed reply used to say nothing at all: the input kept its text,
        // nothing appeared in the thread, and the only way to find out why was
        // the network tab. The rate-limit trigger writes a sentence meant to be
        // read — this is where it gets read.
        setReplyError(message);
        return;
      }
      setReply("");
      setParticipating(true);
      await mutateComments();
    } finally {
      setBusy(false);
    }
  };

  /** Remove one of the viewer's own replies. */
  const removeReply = useCallback(
    async (id: number) => {
      if (!viewerId) return;
      setBusy(true);
      setReplyError(null);
      try {
        const message = await deleteComment(viewerId, id);
        if (message) setReplyError(message);
        await mutateComments();
      } finally {
        setBusy(false);
      }
    },
    [viewerId, mutateComments],
  );

  /** Everyone else's writing, newest first — public takes and replies together. */
  const thread = useMemo(() => {
    const takeRows = (takes?.others ?? []).map((o) => ({
      key: `take:${o.username}:${o.updatedAt}`,
      username: o.username,
      avatarUrl: o.avatarUrl,
      body: o.body,
      score: o.score,
      at: o.updatedAt,
      commentId: null as number | null,
    }));
    const commentRows = (comments ?? []).map((c) => ({
      key: `comment:${c.id}`,
      username: c.users?.username ?? "someone",
      avatarUrl: c.users?.avatar_url ?? null,
      body: c.body,
      score: null as number | null,
      at: c.created_at,
      // Only a reply can be removed from here — a public take is removed from
      // its own card above, which also clears the mirror rows.
      commentId: c.user_id === viewerId ? c.id : null,
    }));
    return [...takeRows, ...commentRows].sort((a, b) => b.at.localeCompare(a.at));
  }, [takes, comments, viewerId]);

  return (
    <section ref={ref} className="space-y-5">
      {/* ── The one box ─────────────────────────────────────────────────── */}
      {!isAuthenticated ? (
        <p className="rounded-2xl border border-surface-800/60 bg-surface-900/40 p-5 text-sm text-surface-400">
          <Link href="/login" className="text-brand-400 hover:text-brand-300">
            Sign in
          </Link>{" "}
          to write about this.
        </p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-surface-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
        {/* Its own strip, outside the card below.
            The card's boundary is what says the buttons inside it act on what
            is inside it. Stacking a control that commits on tap above a control
            that commits on a named button, inside one border, would re-create
            the "which box does this go in" fork this component exists to
            remove — you would not be able to tell by looking whether a filled
            star was saved or still a draft. */}
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-surface-800 bg-surface-900/40 px-4 py-3.5">
          <StarRating
            value={rating}
            onChange={saveScore}
            size="xl"
            allowClear
            disabled={busy}
            label={itemName}
          />
          {/* Appears only once a rating is actually stored, so the card
              acknowledges the act with an available action rather than with a
              sentence about it. It is also the undo for a mis-tap. */}
          {rating != null && (
            <button
              type="button"
              disabled={busy}
              onClick={() => saveScore(null)}
              aria-label="Clear rating"
              className="rounded-full p-1.5 text-surface-500 transition hover:text-red-400 disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="card-accent rounded-2xl p-5">
          <textarea
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={5000}
            // The prompt IS the label. There is no heading above this box
            // telling you what kind of writing belongs in it, because that is
            // the question that stops people.
            placeholder={prompt}
            className="w-full resize-y rounded-xl border border-surface-700 bg-surface-950 px-3.5 py-3 text-[15px] leading-relaxed text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none"
          />

          {/* Absent, not disabled.
              These buttons govern the writing and nothing else now, so with no
              writing there is nothing for them to govern. A greyed-out pair
              makes a claim about the person looking at it — it says the thing
              they just did was not enough. An absent pair makes no claim, which
              is what lets a rating on its own read as a finished act rather
              than an abandoned draft. */}
          {(text.trim() || mine?.body) && (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-3">
              {mine?.body && !dirty ? (
                <>
                  <span className="text-xs text-surface-500">
                    {mine.isPublic ? "Posted" : "Only you can see this"}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(!mine.isPublic)}
                    className="rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-white disabled:opacity-50"
                  >
                    {mine.isPublic ? "Make private" : "Post it"}
                  </button>
                </>
              ) : (
                <>
                  {/* Two named actions rather than a toggle plus one Save. The
                      toggle made publishing a thing you might do by accident,
                      and its label had to describe an audience — which is
                      exactly what makes a blank box feel watched. */}
                  <button
                    type="button"
                    disabled={busy || !text.trim()}
                    onClick={() => save(false)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-white disabled:opacity-40"
                  >
                    <Lock className="size-3" /> Keep private
                  </button>
                  <button
                    type="button"
                    disabled={busy || !text.trim()}
                    onClick={() => save(true)}
                    className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
                  >
                    Post it
                  </button>
                </>
              )}
              {/* Outside the branch on purpose. Emptying the textarea moves you
                  into the draft branch, where both buttons are correctly dead —
                  and without this there would be no live control left to commit
                  the deletion with. */}
              {mine?.body && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={remove}
                  aria-label="Delete"
                  className="rounded-full p-1.5 text-surface-500 transition hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
        </>
      )}

      {/* ── The one thread ──────────────────────────────────────────────── */}
      {thread.length > 0 && (
        <div className="space-y-3">
          {thread.map((row) => (
            <article key={row.key} className="flex gap-3">
              <Link href={`/app/profile/${row.username}`} className="shrink-0">
                <Avatar src={row.avatarUrl} name={row.username} size={28} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-surface-500">
                  <Link
                    href={`/app/profile/${row.username}`}
                    className="font-medium text-surface-300 transition-colors hover:text-white"
                  >
                    {row.username}
                  </Link>
                  <span className="text-surface-600"> · {when(row.at)}</span>
                  {typeof row.score === "number" && row.score > 0 && (
                    <span className="text-amber-400/90"> · ★ {formatStars(row.score)}</span>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-surface-100">
                  {row.body}
                </p>
              </div>
              {/* Yours to take back. There was no way to delete a reply from
                  anywhere in the app — the endpoint existed and nothing called
                  it — so anything posted by mistake stayed posted. */}
              {row.commentId !== null && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeReply(row.commentId!)}
                  aria-label="Delete reply"
                  className="shrink-0 self-start rounded-full p-1.5 text-surface-600 transition hover:text-red-400 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {isAuthenticated && (
        <div className="flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && postReply()}
            maxLength={2000}
            placeholder={thread.length > 0 ? "Say something back…" : "Start the conversation…"}
            className="flex-1 rounded-xl border border-surface-700/50 bg-surface-800/60 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="button"
            onClick={postReply}
            disabled={busy || !reply.trim()}
            aria-label="Send"
            className="btn-primary rounded-xl px-3 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      )}

      {replyError && <p className="text-xs text-red-400">{replyError}</p>}
    </section>
  );
}
