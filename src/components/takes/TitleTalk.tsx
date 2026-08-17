"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Loader2, Lock, Send, Trash2 } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import StarRating from "@components/ui/StarRating";
import { formatStars } from "@/utils/ratingScale";

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
type CommentRow = {
  id: number;
  user_id: string;
  body: string;
  created_at: string;
  users: { username: string | null; avatar_url: string | null } | null;
};

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r)));

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
  itemName,
  imageUrl,
  genres,
  isAuthenticated,
}: {
  itemId: string;
  itemType: "movie" | "tv";
  itemName?: string;
  imageUrl?: string | null;
  genres?: string[];
  isAuthenticated: boolean;
}) {
  const takesKey = `/api/takes?itemId=${itemId}&itemType=${itemType}&scope=title`;
  const commentsKey = `/api/comments?itemId=${itemId}&itemType=${itemType}`;

  const { data: takes, mutate: mutateTakes, isLoading } = useSWR<{
    mine: Mine;
    others: Other[];
  }>(takesKey, fetcher);
  const { data: comments, mutate: mutateComments } = useSWR<CommentRow[]>(commentsKey, fetcher);

  const mine = takes?.mine ?? null;
  const [draft, setDraft] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  // `null` means "not editing" — fall back to whatever is saved.
  const text = draft ?? mine?.body ?? "";
  const rating = score ?? mine?.score ?? null;
  const dirty = draft !== null || score !== null;

  const prompt = useMemo(
    () => PROMPTS[Math.abs(Number(itemId) || 0) % PROMPTS.length],
    [itemId],
  );

  const save = async (isPublic: boolean) => {
    if (!text.trim() && rating == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/takes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          itemType,
          scope: "title",
          score: rating,
          body: text,
          isPublic,
          itemName,
          imageUrl,
          genres,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error ?? "Couldn't save that.");
      setDraft(null);
      setScore(null);
      await mutateTakes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await fetch(
        `/api/takes?itemId=${itemId}&itemType=${itemType}&scope=title&isPublic=${mine?.isPublic ?? false}`,
        { method: "DELETE" },
      );
      setDraft(null);
      setScore(null);
      await mutateTakes();
    } finally {
      setBusy(false);
    }
  };

  const postReply = async () => {
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, itemType, body }),
      });
      if (res.ok) {
        setReply("");
        await mutateComments();
      }
    } finally {
      setBusy(false);
    }
  };

  /** Everyone else's writing, newest first — public takes and replies together. */
  const thread = useMemo(() => {
    const takeRows = (takes?.others ?? []).map((o) => ({
      key: `take:${o.username}:${o.updatedAt}`,
      username: o.username,
      avatarUrl: o.avatarUrl,
      body: o.body,
      score: o.score,
      at: o.updatedAt,
    }));
    const commentRows = (comments ?? []).map((c) => ({
      key: `comment:${c.id}`,
      username: c.users?.username ?? "someone",
      avatarUrl: c.users?.avatar_url ?? null,
      body: c.body,
      score: null as number | null,
      at: c.created_at,
    }));
    return [...takeRows, ...commentRows].sort((a, b) => b.at.localeCompare(a.at));
  }, [takes, comments]);

  return (
    <section className="space-y-5">
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

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
            {/* Rating sits after the writing and is optional. Asking for a
                score first makes the prose a justification of the number
                rather than an account of what happened to you. */}
            <StarRating value={rating} onChange={setScore} size="sm" label={itemName} />

            <div className="ml-auto flex items-center gap-2">
              {mine && !dirty ? (
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
                  <button
                    type="button"
                    disabled={busy}
                    onClick={remove}
                    aria-label="Delete"
                    className="rounded-full p-1.5 text-surface-500 transition hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
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
                    disabled={busy || (!text.trim() && rating == null)}
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
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
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
    </section>
  );
}
