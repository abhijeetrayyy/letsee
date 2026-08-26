"use client";

import Link from "@components/ui/AppLink";
import { MessageCircle } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { getPosterUrl } from "@/utils/imageUrl";
import { formatStars } from "@/utils/ratingScale";

import { titlePath } from "@/utils/urls";
export type FeedTitle = {
  itemId: string;
  itemType: string;
  name: string | null;
  imageUrl: string | null;
};

export type FeedRowData = {
  key: string;
  kind: "take" | "watch";
  author: { id: string; username: string; avatarUrl: string | null };
  createdAt: string;
  body?: string;
  score?: number | null;
  titles: FeedTitle[];
  overflow?: number;
};

function when(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function titleHref(t: FeedTitle) {
  return titlePath(t.itemType, t.itemId, t.name);
}

/**
 * One row of the activity feed.
 *
 * The old card led with a coloured badge — "Watched", "Rated", "Reviewed" —
 * and put whatever the person had actually written underneath in
 * `text-xs text-surface-400 italic line-clamp-2`: smaller, dimmer and greyer
 * than the film's title. The page therefore shouted the verb and whispered the
 * voice, which is the whole reason it read as a ledger rather than a
 * conversation.
 *
 * That is inverted here. On a `take` row the sentence is the largest and
 * brightest element and the poster demotes to a context strip underneath. The
 * verb survives only as a preposition in the byline — "ray · on Plus Minus".
 *
 * There is no badge, and no reaction count on anyone's writing. A visible
 * score attached to something you wrote is the fastest way to make writing feel
 * like a performance being marked, and this feed's job is to make the next
 * person willing to type.
 */
export default function FeedRow({ row }: { row: FeedRowData }) {
  const profileHref = `/app/profile/${row.author.username}`;
  const subject = row.titles[0];

  if (row.kind === "watch") {
    // Deliberately not a card. No border, no background, one line — a watch is
    // context for the people around it, never the point of the page.
    return (
      <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-surface-500">
        <Link href={profileHref} className="shrink-0">
          <Avatar src={row.author.avatarUrl} name={row.author.username} size={20} />
        </Link>
        <p className="min-w-0 flex-1 truncate">
          <Link href={profileHref} className="text-surface-400 transition-colors hover:text-surface-200">
            {row.author.username}
          </Link>{" "}
          watched{" "}
          {row.titles.map((t, i) => (
            <span key={`${t.itemType}:${t.itemId}`}>
              {i > 0 && (i === row.titles.length - 1 && !row.overflow ? " and " : ", ")}
              <Link href={titleHref(t)} className="text-surface-300 transition-colors hover:text-brand-400">
                {t.name ?? "something"}
              </Link>
            </span>
          ))}
          {row.overflow ? ` and ${row.overflow} more` : ""}
          <span className="text-surface-600"> · {when(row.createdAt)}</span>
        </p>
      </div>
    );
  }

  const poster = subject?.imageUrl ? getPosterUrl(subject.imageUrl, "w154") : null;

  return (
    <article className="rounded-xl border border-surface-800/60 bg-surface-900/40 p-4 transition-colors hover:border-surface-700/60">
      <div className="flex items-center gap-2 text-xs text-surface-500">
        <Link href={profileHref} className="shrink-0">
          <Avatar src={row.author.avatarUrl} name={row.author.username} size={24} />
        </Link>
        <Link href={profileHref} className="font-medium text-surface-300 transition-colors hover:text-white">
          {row.author.username}
        </Link>
        {subject && (
          <>
            <span className="text-surface-600">on</span>
            <Link href={titleHref(subject)} className="truncate text-surface-300 transition-colors hover:text-brand-400">
              {subject.name ?? "a title"}
            </Link>
          </>
        )}
        <span className="ml-auto shrink-0 text-surface-600">{when(row.createdAt)}</span>
      </div>

      {/* The row's reason for existing. */}
      <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-surface-100">
        {row.body}
      </p>

      <div className="mt-3 flex items-center gap-3">
        {poster && subject && (
          <Link href={titleHref(subject)} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt=""
              className="h-14 w-10 rounded object-cover"
              loading="lazy"
              decoding="async"
            />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {subject && (
            <Link
              href={titleHref(subject)}
              className="block truncate text-sm text-surface-300 transition-colors hover:text-brand-400"
            >
              {subject.name ?? "View title"}
            </Link>
          )}
          {typeof row.score === "number" && row.score > 0 && (
            <p className="mt-0.5 text-xs text-amber-400/90">★ {formatStars(row.score)}</p>
          )}
        </div>
        {subject && (
          <Link
            href={titleHref(subject)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
          >
            <MessageCircle className="size-3.5" />
            Reply
          </Link>
        )}
      </div>
    </article>
  );
}
