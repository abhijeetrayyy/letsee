"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Check, Loader2, X } from "lucide-react";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import type { MediaStatus } from "@/app/contextAPI/userPrefrence";

/**
 * Episode progress, written as you tap.
 *
 * The old version staged everything: you ticked boxes, the boxes went into a
 * `selectedEpisodes` Set, and "Save changes" computed a diff against what the
 * server held. That design produced a specific and very bad failure — for a
 * show whose episodes were all already ticked the diff was empty, so Save did
 * nothing at all and the show could never leave "watching". `complete-series`
 * exists only to work around it. A staged diff is also the wrong shape for the
 * task: nobody opens this to compose a batch of changes, they open it to say "I
 * finished season 3".
 *
 * So there is no Save button and no diff. Every action writes immediately and
 * optimistically, the same contract as the progress ribbon on the detail page,
 * and the two stay in agreement because neither holds a pending copy of the
 * truth.
 *
 * What this offers that the ribbon cannot is the bulk verb. Tapping 62 cells to
 * mark a finished show is the thing worth removing, so a season marks in one
 * press, and "caught up to here" fills everything before a point — which is how
 * people actually arrive: partway through, mid-season.
 */

type Season = { season_number: number; name: string; episode_count: number; air_date: string | null };
type Ep = { season_number: number; episode_number: number };

type Props = {
  showId: string;
  showName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /**
   * Set when the modal was opened by choosing a status. It is applied on close
   * rather than re-derived from episode count — "dropped at episode 3" has to
   * survive, and counting episodes would call that "watching".
   */
  intendedStatus?: MediaStatus | null;
};

const key = (s: number, e: number) => `${s},${e}`;

export default function EpisodeManagementModal({
  showId,
  showName,
  isOpen,
  onClose,
  onSuccess,
  intendedStatus = null,
}: Props) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const { refresh: refreshInteractions } = useMediaInteraction();

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/tv-seasons?showId=${encodeURIComponent(showId)}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/watched-episodes?showId=${encodeURIComponent(showId)}`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([sRes, wRes]) => {
        if (!alive) return;
        const sd = sRes?.data ?? sRes;
        const wd = wRes?.data ?? wRes;
        setSeasons(((sd?.seasons ?? []) as Season[]).filter((s) => s.season_number > 0 && s.episode_count > 0));
        setWatched(new Set(((wd?.episodes ?? []) as Ep[]).map((e) => key(e.season_number, e.episode_number))));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isOpen, showId]);

  const totals = useMemo(() => {
    let total = 0;
    let seen = 0;
    for (const s of seasons) {
      total += s.episode_count;
      for (let e = 1; e <= s.episode_count; e++) if (watched.has(key(s.season_number, e))) seen += 1;
    }
    return { total, seen };
  }, [seasons, watched]);

  /**
   * One writer for every action. `mark` and `clear` both take a list, so
   * a single episode, a season and a whole series are the same call with a
   * different list — there is no separate code path to fall out of step.
   */
  const apply = useCallback(
    async (eps: Ep[], mark: boolean) => {
      if (eps.length === 0 || busy) return;
      const ks = eps.map((e) => key(e.season_number, e.episode_number));
      const prev = new Set(watched);
      setWatched((cur) => {
        const next = new Set(cur);
        for (const k of ks) (mark ? next.add(k) : next.delete(k));
        return next;
      });
      setBusy(true);
      setTouched(true);
      try {
        const res = mark
          ? await fetch("/api/watched-episodes-bulk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ showId, episodes: eps, action: "mark" }),
            })
          : await fetch("/api/watched-episodes/bulk-delete", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ showId, episodes: eps }),
            });
        // A non-ok status is not an exception, so without this a rejected write
        // left the optimistic state on screen looking saved.
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setWatched(prev);
        toast.error("Couldn't save that");
      } finally {
        setBusy(false);
      }
    },
    [busy, showId, watched],
  );

  const seasonEps = (s: Season): Ep[] =>
    Array.from({ length: s.episode_count }, (_, i) => ({ season_number: s.season_number, episode_number: i + 1 }));

  const seasonSeen = (s: Season) => seasonEps(s).filter((e) => watched.has(key(e.season_number, e.episode_number))).length;

  /** Everything up to and including this episode, across earlier seasons too. */
  const upTo = (s: number, e: number): Ep[] => {
    const out: Ep[] = [];
    for (const season of seasons) {
      if (season.season_number > s) break;
      const last = season.season_number === s ? e : season.episode_count;
      for (let i = 1; i <= last; i++) out.push({ season_number: season.season_number, episode_number: i });
    }
    return out;
  };

  const close = async () => {
    // The status the user picked wins over anything derived from the count.
    if (touched && intendedStatus) {
      await fetch("/api/tv-list-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, status: intendedStatus }),
      }).catch(() => {});
    }
    if (touched) {
      await Promise.all([refreshPreferences(), refreshInteractions()]).catch(() => {});
      onSuccess();
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && void close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, touched, intendedStatus]);

  if (!isOpen || typeof document === "undefined") return null;

  const complete = totals.total > 0 && totals.seen === totals.total;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => void close()}
      role="dialog"
      aria-modal="true"
      aria-label={`Episodes of ${showName}`}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-surface-700 bg-surface-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">{showName}</h3>
            {/* The count is the state, so it is the subtitle rather than a
                progress bar competing with the grid below. */}
            <p className="mt-0.5 font-mono text-xs tabular-nums text-surface-500">
              {loading ? "…" : `${totals.seen} of ${totals.total} episodes`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {busy && <Loader2 className="size-4 animate-spin text-surface-500" aria-label="Saving" />}
            <button
              type="button"
              onClick={() => void close()}
              aria-label="Close"
              className="rounded-lg p-1.5 text-surface-400 transition-colors hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-800/60" />
              ))}
            </div>
          ) : seasons.length === 0 ? (
            <p className="py-8 text-center text-sm text-surface-500">No episodes listed for this show.</p>
          ) : (
            <div className="space-y-4">
              {seasons.map((s) => {
                const seen = seasonSeen(s);
                const full = seen === s.episode_count;
                return (
                  <div key={s.season_number}>
                    <div className="mb-1.5 flex items-baseline gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-surface-500">
                        S{String(s.season_number).padStart(2, "0")}
                      </span>
                      <span className="truncate text-sm text-surface-300">{s.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-surface-600">
                        {seen}/{s.episode_count}
                      </span>
                      {/* One button whose verb follows the state, rather than a
                          Mark and a Clear sitting side by side where only one
                          can ever be the thing you want. */}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void apply(seasonEps(s), !full)}
                        className="shrink-0 rounded-full border border-surface-700 px-2.5 py-1 text-[11px] text-surface-300 transition hover:border-surface-600 hover:text-white disabled:opacity-50"
                      >
                        {full ? "Clear" : "Mark all"}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-[3px]">
                      {seasonEps(s).map((e) => {
                        const on = watched.has(key(e.season_number, e.episode_number));
                        return (
                          <button
                            key={e.episode_number}
                            type="button"
                            disabled={busy}
                            onClick={() => void apply([e], !on)}
                            onDoubleClick={() => void apply(upTo(e.season_number, e.episode_number), true)}
                            title={`S${s.season_number}E${e.episode_number}${on ? " — watched" : ""} · double-click to catch up to here`}
                            aria-label={`Season ${s.season_number}, episode ${e.episode_number}${on ? ", watched" : ""}`}
                            aria-pressed={on}
                            className={`size-4 rounded-[3px] transition-colors disabled:opacity-60 ${
                              on ? "bg-brand-500 hover:bg-brand-400" : "bg-surface-700/70 hover:bg-surface-600"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && seasons.length > 0 && (
          <div className="flex items-center gap-2 border-t border-surface-800 px-4 py-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void apply(seasons.flatMap(seasonEps), !complete)}
              className="btn-primary flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {complete ? "Clear the whole show" : <><Check className="size-4" /> Mark the whole show</>}
            </button>
            <button
              type="button"
              onClick={() => void close()}
              className="rounded-xl border border-surface-700 px-4 py-2.5 text-sm text-surface-300 transition hover:border-surface-600 hover:text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
