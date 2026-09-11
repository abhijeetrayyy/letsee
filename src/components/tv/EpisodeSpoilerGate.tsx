"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useWatchedEpisode } from "./useWatchedEpisode";

/**
 * Progress-gated spoilers.
 *
 * TV Time's 25 million users did not miss the tracker when it shut down;
 * they missed the ritual — mark the episode watched, then read what everyone
 * said, which was hidden until you had. TMDB's episode overviews spoil, its
 * stills spoil, and a guest-star list tells you who comes back. So on an
 * episode page all of that sits behind the viewer's own `watched_episodes`
 * row, with one honest escape hatch: "Show anyway", for the person who read
 * the recap on purpose.
 *
 * Client-side on purpose. The episode page is cached for a day precisely
 * because it reads no session; the gate reads the viewer's progress from the
 * browser. Four gates and the mark button share one SWR entry for the show
 * (`useWatchedEpisode`), so the page asks once and every copy answers
 * together when the button is pressed. Signed-out visitors get the concealed
 * state with the escape hatch, since nothing about them is known.
 *
 * Until the answer arrives, nothing is shown — a spoiler that flashes for a
 * moment before being hidden is a spoiler.
 */
export default function EpisodeSpoilerGate({
  showId,
  seasonNumber,
  episodeNumber,
  label = "what happens",
  children,
}: {
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
  /** What is being hidden, for the notice: "what happens", "the thread". */
  label?: string;
  children: React.ReactNode;
}) {
  const { watched } = useWatchedEpisode(showId, seasonNumber, episodeNumber);
  const [revealed, setRevealed] = useState(false);

  if (watched === null) {
    return <div aria-hidden className="h-10 animate-pulse rounded-xl bg-surface-900/40" />;
  }
  if (watched || revealed) return <>{children}</>;

  return (
    <div className="rounded-xl border border-dashed border-surface-700 bg-surface-900/40 px-4 py-4">
      <p className="flex items-center gap-2 text-sm text-surface-300">
        <EyeOff className="size-4 text-surface-500" />
        Hidden until you&apos;ve watched it — {label}.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-surface-500">Mark the episode watched to reveal it.</span>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="inline-flex items-center gap-1 text-surface-400 underline-offset-2 hover:text-white hover:underline"
        >
          <Eye className="size-3.5" /> Show anyway
        </button>
      </div>
    </div>
  );
}
