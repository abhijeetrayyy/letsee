"use client";

import { Check, LoaderCircle } from "lucide-react";
import Link from "@components/ui/AppLink";
import Faces from "@components/ds/Faces";
import { formatLongDate, parseTmdbDate, toIso } from "@/utils/person/dates";
import { episodePath } from "@/utils/urls";

/**
 * One episode as one row (docs/design/SYSTEM.md §8, `EpisodeRow`): the code
 * in the stamp, the title, the air date, the faces of your people who've
 * watched it, and one check. At least 44 px tall, and the check is the only
 * control on it — the title opens the episode.
 *
 * Nothing about an unwatched episode that could spoil it is rendered: no
 * still, no overview, not even hidden in the DOM. Once you've watched it, two
 * lines of the overview come back as a reminder of which one it was.
 */
export type EpisodeRowData = {
  episode_number: number;
  name?: string | null;
  air_date?: string | null;
  runtime?: number | null;
  overview?: string | null;
  episode_type?: string | null;
};

/** TMDB's `episode_type`, where it's worth a word. "standard" is every other episode. */
const KIND: Record<string, string> = { finale: "Finale", mid_season: "Mid-season finale", premiere: "Premiere" };

export default function EpisodeRow({
  showId,
  showName,
  season,
  ep,
  watched,
  busy = false,
  notOut = false,
  signedIn,
  people = [],
  onToggle,
}: {
  showId: string | number;
  showName?: string | null;
  season: number;
  ep: EpisodeRowData;
  watched: boolean;
  busy?: boolean;
  /** Airs after today: a date instead of a check, because there is nothing true to record yet. */
  notOut?: boolean;
  signedIn: boolean;
  people?: { username: string; avatarUrl: string | null }[];
  onToggle: () => void;
}) {
  const date = parseTmdbDate(ep.air_date);
  const code = `E${String(ep.episode_number).padStart(2, "0")}`;
  const kind = ep.episode_type ? KIND[ep.episode_type] : null;
  const line = [date ? null : "Date to come", typeof ep.runtime === "number" && ep.runtime > 0 ? `${ep.runtime}m` : null, kind].filter(Boolean);

  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-line py-2 last:border-b-0">
      <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-ink-500">{code}</span>
      <div className="min-w-0 flex-1">
        <Link href={episodePath(showId, season, ep.episode_number, showName)} className="block truncate text-base text-ink-0 hover:underline hover:decoration-line-input hover:underline-offset-4">
          {ep.name?.trim() || `Episode ${ep.episode_number}`}
        </Link>
        <p className="truncate font-mono text-xs tabular-nums text-ink-500">
          {date && <time dateTime={toIso(date)}>{formatLongDate(date)}</time>}
          {line.length > 0 && `${date ? " · " : ""}${line.join(" · ")}`}
        </p>
        {watched && ep.overview?.trim() && <p className="mt-1 line-clamp-2 text-sm text-ink-400">{ep.overview}</p>}
      </div>
      {people.length > 0 && (
        <span className="flex shrink-0 items-center" title={`${people.map((p) => p.username).join(", ")} watched it`}>
          <Faces people={people} size={20} />
          <span className="sr-only">{`${people.map((p) => p.username).join(", ")} watched it`}</span>
        </span>
      )}
      {notOut ? (
        <span className="shrink-0 font-mono text-xs uppercase tracking-wide text-ink-500">Not out yet</span>
      ) : signedIn ? (
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={watched}
          aria-label={`${code}${ep.name ? `, ${ep.name}` : ""}: ${watched ? "watched" : "mark watched"}`}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
            watched ? "bg-action text-on-action hover:bg-action-hover" : "text-ink-500 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
          }`}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
        </button>
      ) : null}
    </li>
  );
}
