"use client";

import { useContext, useState } from "react";
import toast from "react-hot-toast";
import { Check, LoaderCircle } from "lucide-react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { markToast } from "@components/ds/markToast";
import { epKey, episodeLabel, positionOf, seasonsOf, upTo, type Ep, type SeasonInfo } from "@/lib/logging/episodes";

/**
 * Where you are with a series: a season, a number, done.
 *
 * The owner (11 Oct 2026): saying "I've watched this much" took one tap per
 * episode, or a modal three steps away. Here it's one tap: the numbers are
 * the season's episodes, and tapping one means *through here* — every aired
 * episode up to it is watched, nothing past it is (lib/logging/episodes
 * `upTo`), in one call (`action: "set"`), with Undo putting back exactly what
 * was there. The season you're in is picked already; others are a tap away.
 *
 * Tapping the episode you're on takes you back one — the way to say "not
 * that one yet". Episodes that haven't aired can't be tapped. The status
 * follows on the server: Watching once anything's marked, Finished once
 * everything is, and On hold or Dropped kept if that's what you'd said.
 */
export default function SeriesPosition({
  showId,
  seasons,
  lastAired,
  watched,
  onChanged,
}: {
  showId: string;
  seasons: SeasonInfo[];
  lastAired: Ep | null;
  /** `s:e` keys of what's marked (the `/api/watched-episodes` cache). */
  watched: Set<string>;
  /** After a save: refetch the episodes (and the marks, which may have moved). */
  onChanged: () => Promise<unknown> | void;
}) {
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const rows = seasonsOf(seasons, watched, lastAired);
  const position = positionOf(seasons, watched, lastAired);
  const inProgress = rows.find((r) => r.seen > 0 && r.seen < r.aired);
  const firstUnseen = rows.find((r) => r.aired > 0 && r.seen < r.aired);
  const [chosen, setChosen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // The season you're in, unless you picked another: part-way through one,
  // else the first with anything left, else where you are.
  const season = rows.find((r) => r.s === chosen) ?? inProgress ?? firstUnseen ?? rows.find((r) => r.s === position?.s) ?? rows[0];
  if (!rows.length || !season) return null;

  const all = upTo(seasons, { s: Number.MAX_SAFE_INTEGER, e: 0 }, lastAired);
  const seen = all.filter((ep) => watched.has(epKey(ep.s, ep.e))).length;
  const current = [...watched];

  const set = async (eps: Ep[], said: string, undoTo: string[]) => {
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/watched-episodes-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId, action: "set", episodes: eps.map((ep) => ({ season_number: ep.s, episode_number: ep.e })) }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      toast.error("That didn't save. Check your connection and try again.");
      return;
    }
    await Promise.all([onChanged(), refreshPreferences()]);
    markToast({
      // One toast per series: a second tap replaces the first's, rather than stacking.
      id: `position-${showId}`,
      text: said,
      undo: async () => {
        const back = await fetch("/api/watched-episodes-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId, action: "set", episodes: undoTo.map((k) => k.split(":").map(Number)).map(([s, e]) => ({ season_number: s, episode_number: e })) }),
        }).catch(() => null);
        if (!back?.ok) toast.error("Couldn't undo that.");
        await Promise.all([onChanged(), refreshPreferences()]);
      },
    });
  };

  const pick = (ep: Ep) => {
    const atIt = position && position.s === ep.s && position.e === ep.e;
    if (atIt) {
      // Back one: the episode before, or nothing at all.
      const list = upTo(seasons, ep, lastAired);
      const prev = list.length > 1 ? list[list.length - 2] : null;
      void set(prev ? upTo(seasons, prev, lastAired) : [], prev ? `Back to ${episodeLabel(prev)}` : "Back to the start — nothing marked", current);
      return;
    }
    const list = upTo(seasons, ep, lastAired);
    const wholeSeason = ep.e === season.listed;
    void set(list, wholeSeason ? `Through season ${ep.s} · ${list.length} of ${all.length} aired` : `Through ${episodeLabel(ep)} · ${list.length} of ${all.length} aired`, current);
  };

  const chip = (on: boolean, done: boolean) =>
    `inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 font-mono text-xs tracking-wide transition-colors disabled:opacity-60 ${
      on ? "bg-ink-0 text-page" : done ? "text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover" : "text-ink-400 ring-1 ring-inset ring-line hover:bg-hover hover:text-ink-0"
    }`;

  return (
    <div className="grid gap-2" aria-busy={busy}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-medium text-ink-500">Where are you?</span>
        <span className="font-mono text-xs uppercase tracking-wide text-ink-400" aria-live="polite">
          {busy ? (
            <LoaderCircle className="inline size-3 animate-spin" aria-hidden />
          ) : position ? (
            `Through ${episodeLabel(position)} · ${seen} of ${all.length} aired`
          ) : (
            "Not started"
          )}
        </span>
      </div>
      {/* Seasons: ✓ when you've seen all that's out, a dot when you're part-way. */}
      <div role="tablist" aria-label="Season" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {rows.map((r) => {
          const done = r.aired > 0 && r.seen >= r.aired;
          const on = r.s === season.s;
          return (
            <button
              key={r.s}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={`Season ${r.s}: ${r.seen} of ${r.aired} aired episodes watched`}
              onClick={() => setChosen(r.s)}
              disabled={busy}
              className={chip(on, done)}
            >
              S{r.s}
              {done ? <Check className="size-3" aria-hidden /> : r.seen > 0 ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
            </button>
          );
        })}
      </div>
      {/* The season's episodes: filled through where you are; tap one to be there. */}
      <div role="group" aria-label={`Season ${season.s} episodes — tap one to mark everything through it`} className="flex flex-wrap gap-1.5">
        {Array.from({ length: season.listed }, (_, i) => i + 1).map((e) => {
          const out = e <= season.aired;
          const on = watched.has(epKey(season.s, e));
          const here = !!position && position.s === season.s && position.e === e;
          return (
            <button
              key={e}
              type="button"
              disabled={busy || !out}
              aria-pressed={on}
              aria-label={!out ? `Episode ${e}, not out yet` : here ? `Episode ${e}, where you are — tap to go back one` : `Through season ${season.s} episode ${e}`}
              title={!out ? "Not out yet" : undefined}
              onClick={() => pick({ s: season.s, e })}
              className={`flex size-9 items-center justify-center rounded-full font-mono text-xs tabular-nums transition-colors disabled:cursor-not-allowed ${
                here
                  ? "bg-action text-on-action ring-2 ring-inset ring-ink-0/20"
                  : on
                    ? "bg-action/80 text-on-action hover:bg-action"
                    : out
                      ? "text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
                      : "text-ink-600 ring-1 ring-inset ring-line"
              }`}
            >
              {e}
            </button>
          );
        })}
      </div>
    </div>
  );
}
