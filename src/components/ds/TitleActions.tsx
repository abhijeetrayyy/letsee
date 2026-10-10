"use client";

import { useContext, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Check, CirclePause, CirclePlay, ListChecks, LoaderCircle, MoreHorizontal, NotebookPen, Repeat, Share2 } from "lucide-react";
import { useDetails } from "@components/ds/LogItButton";
import { markToast } from "@components/ds/markToast";
import { dayLabel } from "@components/ds/DayChip";
import MarkTiles from "@components/ds/MarkTiles";
import PassToButton from "@components/ds/PassToButton";
import SaveContext from "@components/buttons/SaveContext";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { fetchMyViewings } from "@/lib/db/viewings";
import { viewingsKey } from "@/lib/db/keys";
import { menuStatus, stateLine, statusWord, type Status } from "@/lib/logging/titleState";
import { todayIso } from "@/utils/viewings";
import { swrFetcher } from "@/utils/swrFetcher";
import { episodeLabel, epKey, leadsWithEpisode, nextEpisode, progressOf, type Ep, type SeasonInfo } from "@/lib/logging/episodes";
import { getPosterUrl } from "@/utils/imageUrl";

/**
 * A title's actions. First, the marks everyone knows — **Watched · Watching ·
 * Watch later · Favourite** (a series: **Watching · Finished · Watch later ·
 * Favourite**), each one tap on or off (ds/MarkTiles, lib/logging/marks).
 * Under them, **Pass to…** and **⋯**, which holds the rest: when you watched
 * it, who was there, stars and words (ds/LogSheet), another viewing, episodes,
 * stopping a series, sharing. A series you're on leads with its next episode.
 *
 * "Log it" used to come first, alone, and nobody knew what it meant (owner
 * review, 5 Oct 2026). Then "Add to diary" sat beside the marks and the toast
 * after Watched offered "Add date" — asking every time (owner, 10 Oct 2026).
 * Now a tap registers, and the details wait in ⋯ until someone wants them.
 */
export default function TitleActions({
  itemId,
  itemType,
  itemName,
  posterPath,
  genres,
  adult,
  onShare,
  onEpisodes,
  series,
}: {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  posterPath: string | null;
  genres: string[];
  adult?: boolean;
  onShare: () => void;
  /** A series: open the episode tracker. */
  onEpisodes?: () => void;
  /** A series: its seasons and the last aired episode, for the next-episode action. */
  series?: { seasons: SeasonInfo[]; lastAired: Ep | null };
}) {
  const { user, status: authStatus } = useAuth();
  const me = authStatus === "ok" ? user?.id ?? null : null;
  const { getStatus, setStatus, refreshPreferences } = useContext(UserPrefrenceContext);
  // The same cache entry as the viewings list under "Your entry", so a log here refreshes it there.
  const { data: viewings, mutate } = useSWR(me ? viewingsKey(itemId, itemType, me) : null, () => fetchMyViewings(me!, itemId, itemType), {
    revalidateOnFocus: false,
  });
  const [busy, setBusy] = useState(false);

  // A series you've started leads with its next episode. Same cache entry as
  // the progress ribbon below, so a tick here fills a cell there.
  const { data: episodes, mutate: refreshEpisodes } = useSWR<{ episodes?: { season_number: number; episode_number: number }[] }>(
    me && series ? `/api/watched-episodes?showId=${itemId}` : null,
    swrFetcher,
  );
  const watchedEps = new Set((episodes?.episodes ?? []).map((r) => epKey(r.season_number, r.episode_number)));
  const next = series ? nextEpisode(series.seasons, watchedEps, series.lastAired) : null;
  const [marking, setMarking] = useState(false);

  const status = getStatus(itemId, itemType) as Status;
  const state = { kind: itemType, status, viewings: viewings ?? [] };
  const later = status === "watchlist";
  const episodeLeads = !!me && !!series && leadsWithEpisode(watchedEps, status, next);
  const progress = series && watchedEps.size > 0 ? progressOf(series.seasons, watchedEps, series.lastAired) : null;
  const line = !me
    ? null
    : progress
      ? [
          progress.seen >= progress.aired ? `Caught up · ${progress.seen} of ${progress.aired} episodes` : `${progress.seen} of ${progress.aired} episodes`,
          status && status !== "watching" && status !== "watched" ? statusWord(status) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : stateLine(state, todayIso());
  const imageUrl = posterPath ? getPosterUrl(posterPath, "w342") : null;
  const base = { itemId, mediaType: itemType, name: itemName, imgUrl: imageUrl ?? undefined, adult, genres };

  /** POST toggles an episode; the route also moves the show to Watching (or Watched on the last). */
  const toggleEpisode = async (ep: Ep) =>
    fetch("/api/watched-episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: itemId, seasonNumber: ep.s, episodeNumber: ep.e }),
    }).then((r) => r.ok, () => false);

  /**
   * Marks, never toggles: the episode route flips whatever it's given, so a
   * button still showing an episode that was marked meanwhile (Finished, the
   * tracker, another tab) un-marked it while the toast said "Marked".
   */
  const markEpisode = async (ep: Ep) =>
    fetch("/api/watched-episodes-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: itemId, episodes: [{ season_number: ep.s, episode_number: ep.e }], action: "mark" }),
    }).then((r) => r.ok, () => false);

  const markNext = async () => {
    if (!next || marking) return;
    const ep = next;
    // Undo only takes back what this tap added.
    const already = watchedEps.has(epKey(ep.s, ep.e));
    setMarking(true);
    const ok = await markEpisode(ep);
    if (!ok) {
      setMarking(false);
      toast.error("That didn't save. Check your connection.");
      return;
    }
    // Stay busy until the next episode is known: the route toggles, so a
    // second tap on the old label would unmark what was just marked.
    await Promise.all([refreshEpisodes(), refreshPreferences()]).catch(() => {});
    setMarking(false);
    markToast({
      text: `Marked ${episodeLabel(ep)}`,
      undo: already
        ? undefined
        : async () => {
            if (await toggleEpisode(ep)) await Promise.all([refreshEpisodes(), refreshPreferences()]).catch(() => {});
            else toast.error("Couldn't undo that.");
          },
    });
  };

  const changeStatus = async (next: Status, done: string) => {
    if (busy) return;
    setBusy(true);
    const result = await setStatus({ ...base, status: next, keepData: true });
    setBusy(false);
    if (!result.ok) toast.error(result.message ?? "Couldn't change that.");
    else toast.success(done);
  };

  // When, who, stars and words: ⋯ → the details sheet, on your latest entry
  // if there is one. The list under "Your diary" refreshes from the same key.
  const details = useDetails({ itemId, itemType, itemName, imageUrl, genres, adult }, { onChanged: () => void mutate() });
  const latest = viewings?.[0] ?? null;
  const menuStatusChange = me ? menuStatus(itemType, status) : null;

  const title = { itemId, itemType, itemName, imageUrl, genres, adult };

  return (
    // The target of the hero's "Skip to Log it" link (TitleChrome): focusable
    // by script only, so the next Tab lands on the first action.
    <div id="title-actions" tabIndex={-1} className="mt-5 flex scroll-mt-24 flex-col gap-3 focus:outline-none">
      {episodeLeads && next && (
        <button
          type="button"
          onClick={markNext}
          disabled={marking}
          aria-label={`Mark season ${next.s} episode ${next.e} watched`}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-action px-5 text-base font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60"
        >
          {marking ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Watched <span className="font-mono text-sm tracking-wide">{episodeLabel(next)}</span>
        </button>
      )}
      <MarkTiles title={title} logged={(viewings?.length ?? 0) > 0} onLoggedTap={() => details.open(latest)} where="here" />
      <div className="flex flex-wrap items-center gap-2">
        <PassToButton title={{ itemId, itemType, itemName, imageUrl: posterPath }} />
        <MoreMenu
          signedIn={!!me}
          diary={
            me
              ? latest
                ? { label: `Your diary entry · ${dayLabel(latest.watchedOn)}`, run: () => details.open(latest), again: () => details.open(null, { again: true }) }
                : { label: "When, who & stars", run: () => details.open(null) }
              : null
          }
          statusChange={
            menuStatusChange
              ? { label: menuStatusChange.label, run: () => changeStatus(menuStatusChange.to, menuStatusChange.to === "watching" ? "Back to watching" : "Stopped") }
              : null
          }
          onEpisodes={onEpisodes}
          onShare={onShare}
        />
      </div>
      {details.sheet}
      {/* When it's for later, the plan box below already says so. */}
      {line && !later && <p className="text-sm text-ink-400">{line}</p>}
      {later && (
        <SaveContext itemId={itemId} itemType={itemType} itemName={itemName} imageUrl={imageUrl} genres={genres} />
      )}
    </div>
  );
}

/** The menu's width, w-60. */
const MENU_WIDTH = 240;

function MoreMenu({
  signedIn,
  diary,
  statusChange,
  onEpisodes,
  onShare,
}: {
  signedIn: boolean;
  /** The details sheet: your latest entry (and another viewing), or a first one. */
  diary: { label: string; run: () => void; again?: () => void } | null;
  /** At most one: stop a series you're on, or resume one you stopped. */
  statusChange: { label: string; run: () => void } | null;
  onEpisodes?: () => void;
  onShare: () => void;
}) {
  const [open, setOpen] = useState(false);
  /**
   * Which way the menu opens, decided when it opens: toward whichever side of
   * the button has room. The bar wraps on a phone, so the button sits at the
   * left edge on one title and the right on another — a fixed side ran off one
   * edge or the other.
   */
  const [align, setAlign] = useState<"left" | "right">("left");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => root.current && !root.current.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm text-ink-200 hover:bg-hover hover:text-ink-0";
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAlign(r.left + MENU_WIDTH + 8 <= window.innerWidth ? "left" : "right");
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More: when you watched it, who was there, stars, sharing"
        className="flex size-11 items-center justify-center rounded-full text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div role="menu" className={`absolute top-full z-30 mt-2 w-60 rounded-card border border-line-strong bg-overlay p-1.5 shadow-2xl ${align === "left" ? "left-0" : "right-0"}`}>
          {diary && (
            <button type="button" role="menuitem" onClick={pick(diary.run)} className={item}>
              <NotebookPen className="size-4" aria-hidden />
              {diary.label}
            </button>
          )}
          {diary?.again && (
            <button type="button" role="menuitem" onClick={pick(diary.again)} className={item}>
              <Repeat className="size-4" aria-hidden />
              Watched it again
            </button>
          )}
          {onEpisodes && signedIn && (
            <button type="button" role="menuitem" onClick={pick(onEpisodes)} className={item}>
              <ListChecks className="size-4" aria-hidden />
              Mark episodes
            </button>
          )}
          {statusChange && (
            <button type="button" role="menuitem" onClick={pick(statusChange.run)} className={item}>
              {statusChange.label === "Stop watching" ? <CirclePause className="size-4" aria-hidden /> : <CirclePlay className="size-4" aria-hidden />}
              {statusChange.label}
            </button>
          )}
          <button type="button" role="menuitem" onClick={pick(onShare)} className={item}>
            <Share2 className="size-4" aria-hidden />
            Share
          </button>
        </div>
      )}
    </div>
  );
}
