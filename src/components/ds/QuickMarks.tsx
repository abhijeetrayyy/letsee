"use client";

import { useContext, useState } from "react";
import { Check, Clock, Heart, NotebookPen, Play, Plus } from "lucide-react";
import Link from "@components/ui/AppLink";
import Sheet from "@components/ds/Sheet";
import MarkTiles from "@components/ds/MarkTiles";
import { useLogIt, type LogTitle } from "@components/ds/LogItButton";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * Mark a title from its poster, wherever the poster is — Home, Search,
 * someone else's profile, a list — without leaving the page.
 *
 * The owner (5 Oct 2026): someone looking through another person's profile
 * should be able to say "seen it", "want to", "love it" as they go; that's
 * the fastest way to build your own. One small round button in the poster's
 * corner shows where you stand (✓ watched, ▶ watching, ◷ watch later, ♥
 * favourite) or a plus; it opens the marks (ds/MarkTiles) in a sheet, which
 * stays open so you can tap Watched and Favourite together, and closes on
 * Done or a tap outside. Signed out, there's no button.
 */
export function QuickMarkButton({ title, className = "" }: { title: LogTitle; className?: string }) {
  const { user } = useAuth();
  const { getStatus, hasFavorite } = useContext(UserPrefrenceContext);
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const status = getStatus(title.itemId, title.itemType);
  const favourite = hasFavorite(title.itemId);
  const [Icon, said, on] =
    status === "watched"
      ? [Check, "Watched", true]
      : status === "watching"
        ? [Play, "Watching", true]
        : status === "watchlist"
          ? [Clock, "In Watch later", true]
          : favourite
            ? [Heart, "Favourite", true]
            : [Plus, "Not marked", false];

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Mark ${title.itemName} (${said})`}
        aria-haspopup="dialog"
        className={`flex size-8 items-center justify-center rounded-full shadow-sm ring-1 ring-inset transition-colors ${
          on ? "bg-action text-on-action ring-transparent hover:bg-action-hover" : "bg-page/85 text-ink-0 ring-line-strong hover:bg-page"
        } ${className}`}
      >
        <Icon className={`size-4 ${on && (Icon === Heart || Icon === Play) ? "fill-current" : ""}`} aria-hidden />
      </button>
      {open && <QuickMarksSheet title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickMarksSheet({ title, onClose }: { title: LogTitle; onClose: () => void }) {
  const diary = useLogIt(title);
  const poster = title.imageUrl ? getPosterUrl(title.imageUrl, "w185") : null;
  return (
    <Sheet open onClose={onClose} title={title.itemName} description={title.itemType === "tv" ? "Where are you with this series?" : "Seen it, want to, or love it?"}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="aspect-2/3 w-12 shrink-0 rounded-media object-cover ring-1 ring-inset ring-line-strong" />
          )}
          <Link href={titlePath(title.itemType, title.itemId, title.itemName)} onClick={onClose} className="min-w-0 text-sm font-medium text-accent underline decoration-line-input underline-offset-4 hover:text-accent-soft">
            Open {title.itemType === "tv" ? "the series" : "the film"}
          </Link>
        </div>
        <MarkTiles title={title} size="md" onDiary={() => void diary.log({ details: true })} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => void diary.log({ details: true })}
            disabled={diary.busy}
            className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover disabled:opacity-60"
          >
            <NotebookPen className="size-4" aria-hidden />
            Add to diary — date, stars, who
          </button>
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-full bg-ink-0 px-5 text-sm font-semibold text-page transition-colors hover:opacity-90">
            Done
          </button>
        </div>
      </div>
      {diary.sheet}
    </Sheet>
  );
}
