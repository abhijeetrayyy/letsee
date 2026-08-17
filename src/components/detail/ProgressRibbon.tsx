"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { swrFetcher } from "@/utils/swrFetcher";

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
 */

type Season = { season_number: number; episode_count: number; name?: string };
type WatchedRow = { season_number: number; episode_number: number };

const key = (s: number, e: number) => `${s},${e}`;

export default function ProgressRibbon({
  showId,
  seasons,
  isAuthenticated,
}: {
  showId: string | number;
  seasons: Season[];
  isAuthenticated: boolean;
}) {
  const { data, mutate } = useSWR<{ episodes?: WatchedRow[] }>(
    isAuthenticated ? `/api/watched-episodes?showId=${showId}` : null,
    swrFetcher,
  );

  /** Optimistic overlay, so a tap fills instantly rather than after a round trip. */
  const [pending, setPending] = useState<Record<string, boolean>>({});

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
        await fetch("/api/watched-episode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showId: String(showId), seasonNumber: s, episodeNumber: e }),
        });
        await mutate();
      } catch {
        // Snap back rather than leave a cell claiming a state the server
        // never accepted.
        setPending((p) => ({ ...p, [k]: !next }));
      } finally {
        setPending((p) => {
          const { [k]: _drop, ...rest } = p;
          return rest;
        });
      }
    },
    [isAuthenticated, isWatched, mutate, showId],
  );

  if (rows.length === 0) return null;

  const pct = totals.total ? Math.round((totals.seen / totals.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-sm text-surface-300">
          {totals.seen > 0 ? (
            <>
              <span className="font-mono tabular-nums text-white">{totals.seen}</span>
              <span className="text-surface-500"> of {totals.total} episodes</span>
            </>
          ) : (
            <span className="text-surface-500">{totals.total} episodes</span>
          )}
        </p>
        {totals.seen > 0 && (
          <span className="font-mono text-xs tabular-nums text-brand-400">{pct}%</span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((s) => {
          const seen = Array.from({ length: s.episode_count }, (_, i) =>
            isWatched(s.season_number, i + 1),
          );
          const count = seen.filter(Boolean).length;
          return (
            <div key={s.season_number} className="flex items-center gap-3">
              <span className="w-8 shrink-0 font-mono text-[11px] tabular-nums text-surface-500">
                S{String(s.season_number).padStart(2, "0")}
              </span>
              <div className="flex flex-wrap gap-[3px]">
                {seen.map((on, i) => {
                  const ep = i + 1;
                  const label = `Season ${s.season_number}, episode ${ep}${on ? " — watched" : ""}`;
                  return isAuthenticated ? (
                    <button
                      key={ep}
                      type="button"
                      onClick={() => toggle(s.season_number, ep)}
                      title={label}
                      aria-label={label}
                      aria-pressed={on}
                      className={`h-3.5 w-3.5 rounded-[3px] transition-colors ${
                        on
                          ? "bg-brand-500 hover:bg-brand-400"
                          : "bg-surface-700/70 hover:bg-surface-600"
                      }`}
                    />
                  ) : (
                    <span
                      key={ep}
                      title={label}
                      className={`h-3.5 w-3.5 rounded-[3px] ${on ? "bg-brand-500" : "bg-surface-700/70"}`}
                    />
                  );
                })}
              </div>
              <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-surface-600">
                {count}/{s.episode_count}
              </span>
            </div>
          );
        })}
      </div>

      {/* No instruction line. A grid of squares that fill when you tap them
          teaches itself in one tap, and a sentence explaining it would be the
          only text on the page apologising for its own interface. */}
    </div>
  );
}
