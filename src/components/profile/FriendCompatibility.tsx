"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { Sparkles } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { fetchTastePair } from "@/lib/db/taste";
import { titlePath } from "@/utils/urls";

/**
 * What you and this person have both seen.
 *
 * ── Why there is no percentage any more ────────────────────────────────────
 * This used to lead with a 14px ring showing "% taste compatibility", computed
 * from genre-vector cosine over both libraries. It was the largest thing in the
 * panel and the least meaningful thing in it: with about twenty genres, every
 * active user scores high against every other active user, so the number moved
 * hardly at all between a stranger and a twin. `/api/compatibility`'s own
 * comment admitted as much — "a blunt instrument… it reads as flavour, not
 * evidence" — and then rendered it as the headline anyway.
 *
 * The rarity sentence underneath was the real signal and was set in 11px grey.
 * This inverts that. 043 makes the argument for the whole product: "you both
 * like Drama" is not a reason to talk to a stranger; "only the two of us here
 * have seen this" is.
 *
 * ── Cost ───────────────────────────────────────────────────────────────────
 * Read straight from Postgres, and not until the panel is scrolled to. The
 * RPC behind it is pinned to `auth.uid()` and returns a cached row in the
 * normal case — see 093.
 */
export default function FriendCompatibility({ profileId }: { profileId: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();

  const { data, isLoading } = useSWR(
    inView ? (["taste-pair", profileId] as const) : null,
    () => fetchTastePair(profileId),
    { revalidateOnFocus: false },
  );

  // Nothing to say is a real answer here, and it is also what a private
  // profile and a block both return. The panel is absent in all three cases,
  // which is deliberate: a visible "no overlap" box on a profile you are not
  // allowed to see would be a way to probe it.
  const hasEvidence = !!data?.sharedTitles.length && !!data.icebreaker;

  if (!inView || isLoading) {
    return (
      <div
        ref={ref}
        className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4"
        aria-hidden="true"
      >
        <div className="h-3 w-24 rounded bg-surface-800/80" />
        <div className="mt-3 h-4 w-full rounded bg-surface-800/50" />
        <div className="mt-2 h-4 w-2/3 rounded bg-surface-800/40" />
      </div>
    );
  }

  if (!hasEvidence) return null;

  const [headline, ...also] = data.sharedTitles;

  return (
    <div className="rounded-xl border border-brand-500/15 bg-brand-500/[0.04] p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="size-3.5 shrink-0 text-brand-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-400">
          Shared taste
        </h3>
      </div>

      {/* The sentence is the headline, because the sentence is the evidence. */}
      <p className="text-[15px] leading-relaxed text-surface-100">{data.icebreaker}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <Link
          href={titlePath(headline.itemType, headline.itemId, headline.name)}
          className="inline-flex items-center gap-1.5 rounded-full border border-surface-700/60 bg-surface-900/60 px-2.5 py-1 text-xs text-surface-200 transition-colors hover:border-brand-500/40 hover:text-white"
        >
          {headline.name}
          {/* The count, not a score. "3 of 14" is a fact somebody can check. */}
          {headline.totalUsers > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-surface-500">
              {headline.viewers}/{headline.totalUsers}
            </span>
          )}
        </Link>

        {also.map((t) => (
          <Link
            key={`${t.itemType}:${t.itemId}`}
            href={titlePath(t.itemType, t.itemId, t.name)}
            className="rounded-full border border-surface-800/70 px-2.5 py-1 text-xs text-surface-400 transition-colors hover:border-surface-600 hover:text-surface-200"
          >
            {t.name}
          </Link>
        ))}
      </div>

      {data.sharedCount > data.sharedTitles.length && (
        <p className="mt-2.5 text-[11px] text-surface-500">
          {data.sharedCount} titles in common in total.
        </p>
      )}
    </div>
  );
}
