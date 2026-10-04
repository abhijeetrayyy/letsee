"use client";

import toast from "react-hot-toast";
import { Check, LoaderCircle } from "lucide-react";
import { useMarkEpisode } from "./useWatchedEpisode";
import { useEpisodeRevealed } from "./EpisodeSpoilerGate";

/**
 * The episode page's one action (docs/design/PAGES.md, the episode page).
 *
 * Watched: says so, with the day, and a quiet way to take it back. Not
 * watched: the spoiler gate below carries **I've watched it**, so this stays
 * out of the way — unless you chose Show anyway, and then the button is here,
 * because the gate is gone.
 */
export default function MarkEpisodeWatched({ showId, seasonNumber, episodeNumber }: { showId: string; seasonNumber: number; episodeNumber: number }) {
  const { watched, watchedAt, ready, signedIn, toggle, busy } = useMarkEpisode(showId, seasonNumber, episodeNumber);
  const revealed = useEpisodeRevealed(showId, seasonNumber, episodeNumber);

  if (!ready || !signedIn || watched === null) return null;

  const run = async () => {
    if (!(await toggle())) toast.error("That didn't save. Check your connection.");
  };

  if (watched) {
    const day = watchedAt ? new Date(watchedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-10 items-center gap-2 rounded-full bg-raised px-4 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-strong">
          <Check className="size-4" aria-hidden />
          Watched{day ? ` · ${day}` : ""}
        </span>
        <button type="button" onClick={run} disabled={busy} className="text-sm text-ink-500 underline decoration-line-input underline-offset-4 hover:text-ink-0 disabled:opacity-60">
          {busy ? "Unmarking…" : "Unmark"}
        </button>
      </div>
    );
  }

  if (!revealed) return null;
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-action px-5 text-base font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60 sm:w-auto"
    >
      {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
      I&apos;ve watched it
    </button>
  );
}
