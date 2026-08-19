"use client";

import { formatStars } from "@/utils/ratingScale";
import Link from "next/link";
import { useState } from "react";

type ActivityItem = {
  id: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  watched_at: string;
  review_text?: string | null;
  score?: number | null;
  activity_type: "watched" | "rated" | "reviewed" | "list_created";
  list_name?: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function getPosterUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl?.trim()) return "/no-photo.webp";
  const u = imageUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u.slice(1) : u;
  return `https://image.tmdb.org/t/p/w92/${path}`;
}

/**
 * Recent activity, as a list rather than a stack of cards.
 *
 * Each entry used to be a `p-4` bordered card with a 96px poster, a badge and
 * a **ten-glyph** star strip — about 112px per row, ten rows, so roughly
 * 1,100px of scrolling to say "watched these ten things". On a profile that
 * already carries stats, favourites and a watchlist above it, that is most of
 * a screen spent on the least dense thing on the page.
 *
 * Now one line each: small thumb, title, when, and a five-star reading only
 * when a score exists. Four visible, the rest behind a control — the reader
 * asks for more rather than scrolling past it.
 */
import { titlePath } from "@/utils/urls";
export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!items?.length) {
    return (
      <p className="rounded-xl border border-surface-800/60 bg-surface-900/40 px-4 py-6 text-center text-sm text-surface-500">
        Nothing watched yet.
      </p>
    );
  }

  const INITIAL = 4;
  const shown = expanded ? items : items.slice(0, INITIAL);
  const hidden = items.length - shown.length;

  return (
    <div>
      <ul className="divide-y divide-surface-800/50 overflow-hidden rounded-xl border border-surface-800/60 bg-surface-900/30">
        {shown.map((item) => {
          const href = titlePath(item.item_type, item.item_id, item.item_name);
          return (
            <li key={item.id}>
              <Link
                href={href}
                className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-800/40"
              >
                <img
                  src={getPosterUrl(item.image_url)}
                  alt=""
                  className="h-11 w-8 shrink-0 rounded object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-surface-100">{item.item_name}</span>
                  <span className="block truncate text-xs text-surface-500">
                    {item.item_type === "tv" ? "Series" : "Film"} · {formatDate(item.watched_at)}
                    {item.review_text ? " · wrote about it" : ""}
                  </span>
                </span>
                {/* One reading, not ten glyphs. The old strip rendered ten
                    spans per row purely to show a number out of five. */}
                {item.score != null && item.score > 0 && (
                  <span className="shrink-0 text-xs text-amber-400/90">★ {formatStars(item.score)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 w-full rounded-lg py-2 text-xs text-surface-400 transition-colors hover:bg-surface-800/40 hover:text-surface-200"
        >
          Show {hidden} more
        </button>
      )}
      {expanded && items.length > INITIAL && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 w-full rounded-lg py-2 text-xs text-surface-500 transition-colors hover:bg-surface-800/40 hover:text-surface-300"
        >
          Show less
        </button>
      )}
    </div>
  );
}
