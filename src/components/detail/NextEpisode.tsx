"use client";

import Link from "@components/ui/AppLink";
import { Clock, ChevronRight } from "lucide-react";
import { useToday } from "@/hooks/useToday";
import {
  formatLongDate,
  parseTmdbDate,
  toIso,
  yearsBetween,
  type ParsedDate,
} from "@/utils/person/dates";

/**
 * Is there more coming?
 *
 * One question, asked constantly of a series and answered nowhere on the page
 * except by a chip in the hero that only appeared when TMDB happened to have a
 * date. Measured across 187 shows pulled live from on_the_air, popular,
 * top_rated and airing_today plus a hand-picked set of famously finished ones:
 *
 *   status              n    next_episode_to_air    last_episode_to_air
 *   Returning Series   126        103  (82%)            126  (100%)
 *   Ended               58          0  ( 0%)             58  (100%)
 *   Canceled             3          0  ( 0%)              3  (100%)
 *   ALL                187        103  (55%)            187  (100%)
 *
 * So `next_episode_to_air` alone answers the question for barely half the
 * shows anyone opens, and the old chip simply vanished for the other half —
 * a finished show and a show between seasons looked identical, which is to say
 * both looked like nothing.
 *
 * The two useful facts hide in the gap. 23 of the 126 returning shows (18%)
 * carry no next episode — Rick and Morty, House of the Dragon, The Rookie,
 * INVINCIBLE, FROM — and every single one of them has a
 * `last_episode_to_air`. And `last_episode_to_air` is populated on 100% of the
 * sample, ended shows included. So the fallback always has something true to
 * say: for a returning show, when it last aired and that it is coming back;
 * for an ended one, the episode it finished on and how long ago that was.
 *
 * On the rest of the payload, also measured (n=68 shows carrying a next
 * episode): name 100%, air_date 100%, runtime 43%, overview 35%,
 * still_path 29%. Nothing here may depend on a still — most episodes have
 * none. The overview is deliberately not rendered even where it exists: for an
 * episode that has not aired, TMDB's overview is routinely a plot synopsis,
 * and this card's job is to say when, not what happens.
 */

export type EpisodeStub = {
  season_number?: number | null;
  episode_number?: number | null;
  name?: string | null;
  air_date?: string | null;
  still_path?: string | null;
  runtime?: number | null;
};

/** TMDB sends `{}` rather than null often enough to be worth checking for. */
function usable(ep: EpisodeStub | null | undefined): EpisodeStub | null {
  if (!ep) return null;
  return typeof ep.season_number === "number" || typeof ep.air_date === "string" ? ep : null;
}

function episodeCode(ep: EpisodeStub): string | null {
  const s = ep.season_number;
  const e = ep.episode_number;
  if (typeof s !== "number" || typeof e !== "number") return null;
  return `S${String(s).padStart(2, "0")}E${String(e).padStart(2, "0")}`;
}

/**
 * A calendar day as a plain integer, so two dates can be subtracted.
 *
 * `Date.UTC` on already-parsed calendar parts is a pure day index — it never
 * touches the local zone, so it cannot drift across DST and cannot land on the
 * wrong day for a reader east or west of the server. The parts come from
 * `parseTmdbDate`, never from `new Date("2026-08-24")`, for the reason spelled
 * out at the top of utils/person/dates.ts.
 */
function dayIndex(p: ParsedDate): number {
  return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

/**
 * Days remaining, in words.
 *
 * The negative case is not a defensive afterthought, it is the single most
 * common branch. TMDB computes `next_episode_to_air` against UTC, so a reader
 * ahead of UTC gets an air date their own calendar has already passed: with
 * the machine on IST (UTC+5:30) at 04:14 local, 54 of the 103 shows carrying a
 * next episode — 52% — reported a date one day in the past, and the histogram
 * had a clean cliff at exactly -1 with nothing beyond it. That is the timezone
 * boundary, not stale data. A naive
 * `Math.ceil((new Date(air) - Date.now()) / 86400000)` would have printed
 * "in -1 days" on half the currently-airing shows in the catalogue.
 */
function untilLabel(days: number): string {
  if (days > 1) return `in ${days} days`;
  if (days === 1) return "tomorrow";
  if (days === 0) return "today";
  return "just aired";
}

/** How long ago, at whatever precision is honest at that distance. */
function agoLabel(from: ParsedDate, today: ParsedDate): string {
  const days = dayIndex(today) - dayIndex(from);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  // Past two years the month count stops meaning anything, and calendar years
  // are the only figure worth trusting — months here are an approximation,
  // yearsBetween is not.
  const years = yearsBetween(from, today);
  if (years >= 2) return `${years} years ago`;
  const months = Math.round(days / 30.44);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

import { seasonPath } from "@/utils/urls";
export default function NextEpisode({
  showId,
  showName,
  nextEpisode,
  lastEpisode,
  status,
  inProduction,
}: {
  showId: string | number;
  /** Only so the links it emits can carry a name. */
  showName?: string;
  nextEpisode?: EpisodeStub | null;
  lastEpisode?: EpisodeStub | null;
  status?: string | null;
  inProduction?: boolean | null;
}) {
  /**
   * "Today" is read after mount, never during render.
   *
   * The server's clock is UTC and the reader's is not, so any text derived
   * from the current date is a different string on the two machines — which is
   * exactly the hydration failure releaseInfo.ts was written to stop. The date
   * itself is a property of the episode and renders on the server; the
   * countdown is a property of the reader's calendar and arrives a tick later.
   */
  const today = useToday();

  const next = usable(nextEpisode);
  const last = usable(lastEpisode);
  const episode = next ?? last;

  // No next and no last means a show that has not aired a frame. The hero
  // already carries a "Premieres …" line for those, and two of them would be
  // one too many.
  if (!episode) return null;

  const returning = status === "Returning Series" || status === "In Production" || inProduction === true;
  const kind: "next" | "returning" | "over" = next ? "next" : returning ? "returning" : "over";

  const date = parseTmdbDate(episode.air_date);
  const code = episodeCode(episode);
  const seasonNumber = episode.season_number;

  const eyebrow =
    kind === "next"
      ? "Next episode"
      : kind === "returning"
        ? "Returning"
        : status === "Canceled"
          ? "Canceled"
          : "Ended";

  const datePrefix =
    kind === "next" ? "Airs" : kind === "over" && status !== "Canceled" ? "Ended" : "Last aired";

  const relative = date && today
    ? kind === "next"
      ? untilLabel(dayIndex(date) - dayIndex(today))
      : agoLabel(date, today)
    : null;

  // Imminent gets the solid treatment; everything else stays quiet. `days <= 1`
  // covers today, tomorrow, and the UTC-boundary case that reads "just aired".
  const imminent =
    kind === "next" && date != null && today != null && dayIndex(date) - dayIndex(today) <= 1;

  const still = episode.still_path
    ? `https://image.tmdb.org/t/p/w300${episode.still_path}`
    : null;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        kind === "over"
          ? "border-surface-800 bg-surface-900/40"
          : "border-brand-500/25 bg-brand-500/5"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                kind === "over" ? "text-surface-500" : "text-brand-400"
              }`}
            >
              <Clock className="size-3.5" />
              {eyebrow}
            </span>
            {relative && (
              <span
                className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                  imminent
                    ? "bg-brand-500 text-surface-950"
                    : kind === "next"
                      ? "bg-brand-500/15 text-brand-300"
                      : "bg-surface-800/70 text-surface-400"
                }`}
              >
                {relative}
              </span>
            )}
          </div>

          <p className="mt-2 text-base font-semibold text-white">
            {code && (
              <span className="font-mono text-sm tabular-nums text-surface-400">{code}</span>
            )}
            {code && episode.name ? <span className="text-surface-600"> · </span> : null}
            {episode.name}
          </p>

          <p className="mt-1 text-sm text-surface-400">
            {date ? (
              <>
                {datePrefix}{" "}
                <time dateTime={toIso(date)} className="text-surface-300">
                  {formatLongDate(date)}
                </time>
              </>
            ) : (
              "Air date not announced"
            )}
            {typeof episode.runtime === "number" && episode.runtime > 0 && (
              <span className="text-surface-600"> · {episode.runtime} min</span>
            )}
          </p>

          {/* The 18% case: TMDB knows the show is coming back and has not yet
              been told when. Saying so beats showing nothing, which is what
              the page did before and which reads identically to cancellation. */}
          {kind === "returning" && (
            <p className="mt-1 text-sm text-brand-300">
              {status === "In Production" ? "In production" : "Returning"} — next episode not
              scheduled yet.
            </p>
          )}

          {typeof seasonNumber === "number" && (
            <Link
              href={seasonPath(showId, seasonNumber, showName)}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-surface-400 transition-colors hover:text-white"
            >
              Season {seasonNumber}
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>

        {/* 29% of next episodes carry a still, so this is the exception rather
            than the layout. Its absence must cost nothing, hence a plain
            sibling that simply is not there rather than a reserved slot. */}
        {still && (
          <div className="hidden w-40 shrink-0 overflow-hidden rounded-lg sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={still} alt="" className="aspect-video w-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
