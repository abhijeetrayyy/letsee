"use client";

import { useCallback, useContext, useMemo, useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { Section } from "@components/detail/TitleChrome";
import { epKey, progressOf, type Ep } from "@/lib/logging/episodes";

/**
 * Where you are in a series, as one object.
 *
 * This is the section a database cannot have and a journal cannot do without.
 * Every other site can tell you Breaking Bad has 62 episodes; only this one
 * knows you have seen 41 of them, that you stopped in the middle of season 4,
 * and that the next one is S04E07. So that fact goes at the top of the page,
 * ahead of the synopsis, and it is drawn rather than written — a sentence
 * takes a second to parse, a shape takes none.
 *
 * One cell per episode, seasons as rows. It costs nothing extra: `seasons[]`
 * with its `episode_count` is already on the show payload, so the whole grid
 * is drawn without a single additional TMDB call. Watched state comes from one
 * request the page was already positioned to make.
 *
 * Cells are also the control. The user asked for one-tap episode marking —
 * "very easy, make it very convenient" — and a grid of episodes you can see is
 * the most direct place to put it: tap a cell, it fills. No modal, no list to
 * scroll, no season picker first.
 *
 * Shown once you've started, and until you've finished. To someone deciding whether to
 * begin, a wall of empty squares answered nothing — and on a long show it was
 * the tallest thing on the page: One Piece's 1,180 episodes drew about 70 rows
 * of them. Past `DENSE` episodes each season becomes one bar instead (marking
 * moves to the season browser below, where the rows are).
 */

const DENSE = 160;

type Season = { season_number: number; episode_count: number; name?: string };
type WatchedRow = { season_number: number; episode_number: number };

const key = (s: number, e: number) => `${s},${e}`;

export default function ProgressRibbon({
  showId,
  seasons,
  isAuthenticated,
  lastAired = null,
}: {
  showId: string | number;
  seasons: Season[];
  isAuthenticated: boolean;
  /** The last episode out, so "caught up" means what the title bar means by it: every aired one. */
  lastAired?: Ep | null;
}) {
  const { data, mutate } = useSWR<{ episodes?: WatchedRow[] }>(
    isAuthenticated ? `/api/watched-episodes?showId=${showId}` : null,
    swrFetcher,
  );

  /**
   * /api/watched-episode does not only write an episode: it calls
   * ensureShowInMediaStatus and autoTransitionStatus, so a tick can move the
   * whole show from `watchlist` to `watching`, or to `watched` on the last one.
   * Revalidating only the episode list left the status in the action bar —
   * fed by these two providers — still showing the previous status until a
   * reload. EpisodeManagementModal already refreshes both; this matches it.
   */
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const { refresh: refreshInteractions } = useMediaInteraction();

  /** Optimistic overlay, so a tap fills instantly rather than after a round trip. */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<string | null>(null);

  const real = useMemo(() => {
    const set = new Set<string>();
    for (const r of data?.episodes ?? []) set.add(key(r.season_number, r.episode_number));
    return set;
  }, [data]);

  const isWatched = useCallback(
    (s: number, e: number) => {
      const k = key(s, e);
      return k in pending ? pending[k] : real.has(k);
    },
    [pending, real],
  );

  const rows = useMemo(
    () => seasons.filter((s) => s.episode_count > 0 && s.season_number > 0),
    [seasons],
  );

  const totals = useMemo(() => {
    let total = 0;
    let seen = 0;
    for (const s of rows) {
      total += s.episode_count;
      for (let e = 1; e <= s.episode_count; e++) if (isWatched(s.season_number, e)) seen += 1;
    }
    return { total, seen };
  }, [rows, isWatched]);

  const toggle = useCallback(
    async (s: number, e: number) => {
      if (!isAuthenticated) return;
      const k = key(s, e);
      const next = !isWatched(s, e);
      setPending((p) => ({ ...p, [k]: next }));
      try {
        // POST toggles: the route deletes the row when it already exists and
        // re-derives the show's status either way, so there is no DELETE verb
        // to call and no second code path to keep in step.
        const res = await fetch("/api/watched-episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId: String(showId), seasonNumber: s, episodeNumber: e }),
        });
        /**
         * `fetch` only rejects on a network failure, so without this a 400 or a
         * 500 counted as success: the cell filled, the optimistic value was
         * dropped, and it quietly reverted to whatever the server still held.
         * From the outside that is indistinguishable from a tap that did not
         * register — which is exactly the report this fixes.
         */
        if (!res.ok) throw new Error(String(res.status));
        setFailed(null);
        await Promise.all([
          mutate(),
          refreshPreferences(),
          refreshInteractions(),
        ]).catch(() => {});
      } catch {
        // Snap back rather than leave a cell claiming a state the server
        // never accepted, and say so — a cell that silently un-fills reads as
        // a broken control rather than a failed write.
        setPending((p) => ({ ...p, [k]: !next }));
        setFailed(k);
      } finally {
        setPending((p) => {
          const { [k]: _drop, ...rest } = p;
          return rest;
        });
      }
    },
    [isAuthenticated, isWatched, mutate, showId, refreshPreferences, refreshInteractions],
  );

  // Nothing until the list is in and has something on it: an empty grid would
  // flash and vanish, and an unstarted show has nothing to say here. Nor once
  // every aired episode is ticked — "Caught up · 62 of 62" under the title and
  // "All 62 episodes, watched" in the glance panel already say so, in a line
  // each; announced episodes that haven't aired don't count against that.
  const out = progressOf(seasons, new Set([...real].map((k) => epKey(...(k.split(",").map(Number) as [number, number])))), lastAired);
  if (!isAuthenticated || !data || rows.length === 0 || totals.seen === 0 || (out.aired > 0 && out.seen >= out.aired)) return null;
  const dense = totals.total > DENSE;

  /**
   * Never round a real episode down to nothing. One of Grey's Anatomy's 466 is
   * 0.2%, which printed as "0%" beside a filled cell and read as "my tap did
   * not count". Anything above zero shows at least 1%.
   */
  const raw = totals.total ? (totals.seen / totals.total) * 100 : 0;
  const pct = raw > 0 ? Math.max(1, Math.round(raw)) : 0;

  return (
    <Section title="Your progress">
      <div className="rounded-2xl border border-line bg-raised/40 p-4 sm:p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <p className="text-sm text-ink-300">
            <span className="font-mono tabular-nums text-ink-0">{totals.seen}</span>
            <span className="text-ink-500"> of {totals.total} episodes</span>
          </p>
          <span className="font-mono text-xs tabular-nums text-accent">{pct}%</span>
        </div>

        <div className="space-y-2">
          {rows.map((s) => {
            const seen = Array.from({ length: s.episode_count }, (_, i) =>
              isWatched(s.season_number, i + 1),
            );
            const count = seen.filter(Boolean).length;
            return (
              <div key={s.season_number} className="flex items-center gap-3">
                <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-ink-500">
                  S{String(s.season_number).padStart(2, "0")}
                </span>
                {dense ? (
                  <div
                    role="img"
                    aria-label={`Season ${s.season_number}: ${count} of ${s.episode_count} watched`}
                    className="h-2 flex-1 overflow-hidden rounded-full bg-hover/70"
                  >
                    <div className="h-full rounded-full bg-action" style={{ width: `${(count / s.episode_count) * 100}%` }} />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-0.75">
                    {seen.map((on, i) => {
                      const ep = i + 1;
                      const label = `Season ${s.season_number}, episode ${ep}${on ? " — watched" : ""}`;
                      return (
                        <button
                          key={ep}
                          type="button"
                          onClick={() => toggle(s.season_number, ep)}
                          title={label}
                          aria-label={label}
                          aria-pressed={on}
                          className={`h-3.5 w-3.5 rounded-xs transition-colors ${
                            on
                              ? "bg-action hover:bg-action-hover"
                              : "bg-hover/70 hover:bg-active"
                          }`}
                        />
                      );
                    })}
                  </div>
                )}
                <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-ink-600">
                  {count}/{s.episode_count}
                </span>
              </div>
            );
          })}
        </div>

        {failed && (
          <p className="mt-3 text-xs text-danger">Couldn&apos;t save that one. Tap it again.</p>
        )}

        {/* No instruction line. A grid of squares that fill when you tap them
            teaches itself in one tap, and a sentence explaining it would be the
            only text on the page apologising for its own interface. */}
      </div>
    </Section>
  );
}
