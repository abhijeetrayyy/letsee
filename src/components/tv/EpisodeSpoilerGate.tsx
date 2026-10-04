"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { Check, Eye, EyeOff, LoaderCircle } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useMarkEpisode } from "./useWatchedEpisode";

/**
 * "Show anyway" is one decision per episode, not one per box. Shared across
 * every gate on the page through a tiny store, so revealing once reveals the
 * overview, the stills, the guest stars and the thread together.
 */
const revealedEpisodes = new Set<string>();
const listeners = new Set<() => void>();
function reveal(key: string) {
  revealedEpisodes.add(key);
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Whether "Show anyway" has been chosen for this episode, on this page. */
export function useEpisodeRevealed(showId: string, seasonNumber: number, episodeNumber: number): boolean {
  const key = `${showId}:${seasonNumber}:${episodeNumber}`;
  return useSyncExternalStore(subscribe, () => revealedEpisodes.has(key), () => false);
}

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
  primary = false,
  holds,
  children,
}: {
  showId: string;
  seasonNumber: number;
  episodeNumber: number;
  /** What is being hidden, for the notice: "what happens", "the thread". */
  label?: string;
  /**
   * One gate per page (docs/design/SYSTEM.md §8, `SpoilerGate`). The primary gate names everything the page is holding
   * back; the others stay out of the way until the episode is watched or
   * revealed.
   */
  primary?: boolean;
  /** For the primary gate: everything folded on this page, in reading order. */
  holds?: string[];
  children: React.ReactNode;
}) {
  const { watched, signedIn, toggle, busy } = useMarkEpisode(showId, seasonNumber, episodeNumber);
  const pathname = usePathname();
  const key = `${showId}:${seasonNumber}:${episodeNumber}`;
  const revealed = useEpisodeRevealed(showId, seasonNumber, episodeNumber);
  const setRevealed = () => reveal(key);

  if (watched === null) {
    return primary ? <div aria-hidden className="h-24 rounded-card bg-raised/40" /> : null;
  }
  if (watched || revealed) return <>{children}</>;

  if (!primary) return null;
  const list = holds?.length ? holds : [label];
  const listed = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0];
  return (
    <div className="rounded-card border border-line-strong bg-raised px-4 py-4 sm:px-5">
      <p className="flex items-start gap-2.5 text-base font-medium text-ink-0">
        <EyeOff className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
        {signedIn ? "You haven\u2019t marked this episode watched." : "Spoilers are folded on this page."}
      </p>
      <p className="mt-1.5 pl-6.5 text-sm text-ink-400">
        {listed.charAt(0).toUpperCase() + listed.slice(1)} {signedIn ? "are folded until you do." : "stay folded unless you ask."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 pl-6.5">
        {signedIn ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!(await toggle())) toast.error("That didn't save. Check your connection.");
            }}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-action px-4 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            I&apos;ve watched it
          </button>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="inline-flex h-10 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
            Sign in to mark it
          </Link>
        )}
        <button
          type="button"
          onClick={setRevealed}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
        >
          <Eye className="size-4" aria-hidden /> Show anyway
        </button>
      </div>
    </div>
  );
}
