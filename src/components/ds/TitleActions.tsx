"use client";

import { useContext, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Bookmark, BookOpen, Check, CirclePause, CirclePlay, Heart, ListChecks, LoaderCircle, MoreHorizontal, Share2 } from "lucide-react";
import LogItButton, { useLogIt } from "@components/ds/LogItButton";
import PassToButton from "@components/ds/PassToButton";
import SaveContext from "@components/buttons/SaveContext";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { fetchMyViewings } from "@/lib/db/viewings";
import { viewingsKey } from "@/lib/db/keys";
import { menuStatus, primaryAction, saveAction, stateLine, statusWord, type Status } from "@/lib/logging/titleState";
import { todayIso } from "@/utils/viewings";
import { swrFetcher } from "@/utils/swrFetcher";
import { episodeLabel, epKey, leadsWithEpisode, nextEpisode, progressOf, type Ep, type SeasonInfo } from "@/lib/logging/episodes";
import { getPosterUrl } from "@/utils/imageUrl";

/**
 * A title's actions (docs/design/SYSTEM.md §8, `ActionBar`): **Log it** —
 * or **Log again** once you have — then **Save**, **Pass to…**, and one
 * "more" menu for everything else. Under it, one line saying where you stand.
 *
 * One way to record, in view: a series you've started leads with its next
 * episode, and logging a night of it in your diary moves into the menu (two
 * green-and-outlined "watched" buttons side by side read as two ways to do the
 * same thing). The menu holds only what isn't on the bar — favourite,
 * episodes, one status change for a series, share — not the
 * status jargon it used to list (want to watch, mark as watching, clear).
 *
 * The rules live in `src/lib/logging/titleState.ts` and are tested there:
 * logging is the only way to mark something watched, saving is for things
 * you haven't watched, a series in progress stays in progress.
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
  const { getStatus, setStatus, togglePreference, hasFavorite, refreshPreferences } = useContext(UserPrefrenceContext);
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
  const primary = primaryAction(state);
  const save = saveAction(state);
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

  const markNext = async () => {
    if (!next || marking) return;
    const ep = next;
    setMarking(true);
    const ok = await toggleEpisode(ep);
    if (!ok) {
      setMarking(false);
      toast.error("That didn't save. Check your connection.");
      return;
    }
    // Stay busy until the next episode is known: the route toggles, so a
    // second tap on the old label would unmark what was just marked.
    await Promise.all([refreshEpisodes(), refreshPreferences()]).catch(() => {});
    setMarking(false);
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Marked {episodeLabel(ep)}
          <button
            type="button"
            className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
            onClick={async () => {
              toast.dismiss(t.id);
              if (await toggleEpisode(ep)) await Promise.all([refreshEpisodes(), refreshPreferences()]).catch(() => {});
              else toast.error("Couldn't undo that.");
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  };

  const changeStatus = async (next: Status, done: string) => {
    if (busy) return;
    setBusy(true);
    const result = await setStatus({ ...base, status: next, keepData: true });
    setBusy(false);
    if (!result.ok) toast.error(result.message ?? "Couldn't change that.");
    else toast.success(done);
  };

  const toggleSave = () =>
    save.saved ? changeStatus(null, "Removed from Up next") : changeStatus("watchlist", "Saved to Up next");

  const favourite = hasFavorite(itemId);
  // The diary log for a series you're on, offered from the menu (see above).
  const diary = useLogIt(
    { itemId, itemType, itemName, imageUrl, genres, adult },
    { onLogged: () => void mutate(), onUndone: () => void mutate() },
  );
  const menuStatusChange = me ? menuStatus(itemType, status) : null;

  const toggleFavourite = async () => {
    const result = await togglePreference({ funcType: "favorite", itemId: Number(itemId), name: itemName, mediaType: itemType, imgUrl: imageUrl ?? undefined, adult: !!adult, genres, currentState: favourite });
    if (!result.ok) toast.error(result.message ?? "Couldn't change that.");
  };

  return (
    // The target of the hero's "Skip to Log it" link (TitleChrome): focusable
    // by script only, so the next Tab lands on the first action.
    <div id="title-actions" tabIndex={-1} className="mt-5 flex scroll-mt-24 flex-col gap-3 focus:outline-none">
      {/* On a phone the log takes the full width and the rest sit in one row beneath it. */}
      <div className="flex flex-wrap items-center gap-2">
        {episodeLeads && next && (
          <button
            type="button"
            onClick={markNext}
            disabled={marking}
            aria-label={`Mark season ${next.s} episode ${next.e} watched`}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-action px-5 text-base font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60 sm:w-auto"
          >
            {marking ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            Watched <span className="font-mono text-sm tracking-wide">{episodeLabel(next)}</span>
          </button>
        )}
        {!episodeLeads && (
          <LogItButton
            className="w-full sm:w-auto"
            itemId={itemId}
            itemType={itemType}
            itemName={itemName}
            imageUrl={imageUrl}
            genres={genres}
            adult={adult}
            label={primary.label}
            onLogged={() => void mutate()}
            onUndone={() => void mutate()}
          />
        )}
        {me && save.show && (
          <button
            type="button"
            onClick={toggleSave}
            disabled={busy}
            aria-pressed={save.saved}
            className={`inline-flex h-11 items-center gap-2 rounded-full px-5 text-base font-medium transition-colors disabled:opacity-60 ${
              save.saved ? "bg-active text-ink-0" : "text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover"
            }`}
          >
            <Bookmark className={`size-4 ${save.saved ? "fill-current" : ""}`} aria-hidden />
            {save.saved ? "Saved" : "Save"}
          </button>
        )}
        <PassToButton title={{ itemId, itemType, itemName, imageUrl: posterPath }} />
        <MoreMenu
          signedIn={!!me}
          favourite={favourite}
          onFavourite={toggleFavourite}
          statusChange={
            menuStatusChange
              ? { label: menuStatusChange.label, run: () => changeStatus(menuStatusChange.to, menuStatusChange.to === "watching" ? "Back to watching" : "Stopped") }
              : null
          }
          onDiary={episodeLeads ? () => (diary.logged ? diary.openDetails() : void diary.log()) : undefined}
          diaryLabel={diary.logged ? "Add details to tonight" : "Add tonight to your diary"}
          onEpisodes={onEpisodes}
          onShare={onShare}
        />
      </div>
      {diary.sheet}
      {/* When saved, the plan box below already says so. */}
      {line && !save.saved && <p className="text-sm text-ink-400">{line}</p>}
      {save.saved && (
        <SaveContext itemId={itemId} itemType={itemType} itemName={itemName} imageUrl={imageUrl} genres={genres} />
      )}
    </div>
  );
}

/** The menu's width, w-60. */
const MENU_WIDTH = 240;

function MoreMenu({
  signedIn,
  favourite,
  onFavourite,
  statusChange,
  onDiary,
  diaryLabel,
  onEpisodes,
  onShare,
}: {
  signedIn: boolean;
  favourite: boolean;
  onFavourite: () => void;
  /** At most one: stop a series you're on, or resume one you stopped. */
  statusChange: { label: string; run: () => void } | null;
  /** A series you've started: log a night of it in your diary. */
  onDiary?: () => void;
  diaryLabel: string;
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
        aria-label="More"
        className="flex size-11 items-center justify-center rounded-full text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {open && (
        <div role="menu" className={`absolute top-full z-30 mt-2 w-60 rounded-card border border-line-strong bg-overlay p-1.5 shadow-2xl ${align === "left" ? "left-0" : "right-0"}`}>
          {signedIn && (
            <button type="button" role="menuitem" onClick={pick(onFavourite)} className={item}>
              <Heart className={`size-4 ${favourite ? "fill-current" : ""}`} aria-hidden />
              {favourite ? "Remove from favourites" : "Add to favourites"}
            </button>
          )}
          {onDiary && signedIn && (
            <button type="button" role="menuitem" onClick={pick(onDiary)} className={item}>
              <BookOpen className="size-4" aria-hidden />
              {diaryLabel}
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
