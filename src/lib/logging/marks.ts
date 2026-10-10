/**
 * The marks: Watched · Watching · Watch later · Favourite for a film;
 * Watching · Finished · Watch later · Favourite for a series. What each shows, and what a tap does,
 * as plain functions — tested in tests/unit/marks.test.ts.
 *
 * This replaces "Log it" as the first thing on a title. The owner (5 Oct 2026):
 * nobody knew what "Log" meant; Watched, Watch later and Favourite are the
 * words everyone already knows (Letterboxd, IMDb, every streaming app), so
 * they're the buttons, always visible, each one tap and one tap back.
 *
 * Two kinds of effort, kept apart:
 *
 * - **A mark** says what's true: you've seen it, you want to, you love it. It
 *   has no date. Marking fifty films you saw over the years puts fifty films
 *   in your library — not fifty "watched today" in your diary and everyone's
 *   feed. (Saved with `dated: false`; migration-free, see utils/mediaStatus.)
 * - **A log** is a viewing: a day, stars, who was there, your words. It's the
 *   "Add date & rating" under the marks, for when you want to — and a log
 *   marks the title watched too.
 *
 * The rules that stay from titleState.ts: a film you've logged is watched (its
 * Watched can't be switched off from here — the diary is a record); Watch
 * later is for what you haven't seen; a series in progress stays in progress.
 */
import type { Kind, Status } from "./titleState";

export type MarkKey = "watched" | "watching" | "finished" | "later" | "favourite";

export type MarkState = {
  kind: Kind;
  status: Status;
  favourite: boolean;
  /** Any logged viewing: the diary says you watched it. */
  logged: boolean;
};

export type Mark = {
  key: MarkKey;
  label: string;
  on: boolean;
  /** Can't be tapped, and why — said in the tile's title and to screen readers. */
  disabled: string | null;
};

const stopped = (s: Status) => s === "on_hold" || s === "dropped";

/** The in-progress tile says where it stands: Watching, On hold, or Dropped. */
const progressLabel = (s: Status) => (s === "on_hold" ? "On hold" : s === "dropped" ? "Dropped" : "Watching");

/**
 * Where something you've started stands: **Watching · On hold · Dropped**.
 *
 * The owner (10 Oct 2026) wanted on hold and dropped back — they'd become one
 * "Stopped", reachable only as "Stop watching" in a series' menu, and a film
 * couldn't be paused or dropped at all. They come back as a row under the
 * marks that appears once you've started something (and only then, so a
 * first visit still sees four plain choices): one tap moves between them,
 * with Undo. On hold keeps your place and waits in Up next; Dropped says
 * you're done, without pretending you never started.
 */
export type Stage = "watching" | "on_hold" | "dropped";

export function stagesFor(s: MarkState): { key: Stage; label: string; on: boolean }[] | null {
  if (s.status !== "watching" && !stopped(s.status)) return null;
  return [
    { key: "watching", label: "Watching", on: s.status === "watching" },
    { key: "on_hold", label: "On hold", on: s.status === "on_hold" },
    { key: "dropped", label: "Dropped", on: s.status === "dropped" },
  ];
}

/** The toast after moving between them. */
export function saidAfterStage(stage: Stage): string {
  switch (stage) {
    case "watching":
      return "Back to watching";
    case "on_hold":
      return "On hold — it keeps your place";
    case "dropped":
      return "Dropped";
  }
}

/** Where a stage leads next, said under the toast. */
export function hintAfterStage(stage: Stage, kind: Kind): string | undefined {
  if (stage === "on_hold") return "It waits for you in Up next.";
  if (stage === "dropped") return kind === "tv" ? "Your episodes stay marked. Pick it back up any time." : "Pick it back up any time.";
  return undefined;
}

export function marksFor(s: MarkState): Mark[] {
  const later: Mark = {
    key: "later",
    label: "Watch later",
    on: s.status === "watchlist",
    disabled: null,
  };
  const favourite: Mark = { key: "favourite", label: "Favourite", on: s.favourite, disabled: null };

  if (s.kind === "movie") {
    // Watching a film too (owner, 5 Oct 2026): half-way through, or over two
    // nights — "in progress", like a series.
    const watched = s.status === "watched" || s.logged;
    const watching = s.status === "watching" || stopped(s.status);
    return [
      { key: "watched", label: "Watched", on: watched, disabled: null },
      { key: "watching", label: progressLabel(s.status), on: watching, disabled: null },
      { ...later, disabled: (watched || watching) && !later.on ? (watching ? "You're watching it" : "You've watched it") : null },
      favourite,
    ];
  }

  const finished = s.status === "watched";
  const watching = s.status === "watching" || stopped(s.status);
  return [
    { key: "watching", label: progressLabel(s.status), on: watching, disabled: null },
    { key: "finished", label: "Finished", on: finished, disabled: null },
    { ...later, disabled: (watching || finished) && !later.on ? (finished ? "You've finished it" : "You're watching it") : null },
    favourite,
  ];
}

/** What a tap on a mark does. */
export type Tap =
  /** Write this status; `null` clears it (keeping ratings, notes and the diary). */
  | { do: "status"; status: Status; dated: false }
  /** A series, finished: every aired episode marked, status watched, no date. */
  | { do: "finish" }
  | { do: "favourite"; on: boolean }
  /** Watched can't be undone from here once it's in the diary: offer the diary instead. */
  | { do: "logged" }
  | { do: "nothing" };

export function tapOf(s: MarkState, key: MarkKey): Tap {
  const mark = marksFor(s).find((m) => m.key === key);
  if (!mark || mark.disabled) return { do: "nothing" };
  switch (key) {
    case "favourite":
      return { do: "favourite", on: !mark.on };
    case "later":
      return { do: "status", status: mark.on ? null : "watchlist", dated: false };
    case "watched":
      if (!mark.on) return { do: "status", status: "watched", dated: false };
      return s.logged ? { do: "logged" } : { do: "status", status: null, dated: false };
    case "watching":
      // On hold or dropped → back to watching; watching → not watching.
      if (stopped(s.status)) return { do: "status", status: "watching", dated: false };
      return { do: "status", status: mark.on ? null : "watching", dated: false };
    case "finished":
      return mark.on ? { do: "status", status: "watching", dated: false } : { do: "finish" };
  }
}

/** The words after a tap, for the toast. */
export function saidAfter(key: MarkKey, on: boolean, kind: Kind): string {
  switch (key) {
    case "watched":
      return on ? "Marked as watched" : "No longer marked watched";
    case "watching":
      return on ? "Marked as watching" : "No longer watching";
    case "finished":
      return on ? (kind === "tv" ? "Finished — every episode marked" : "Marked as finished") : "Back to watching";
    case "later":
      return on ? "Added to Watch later" : "Removed from Watch later";
    case "favourite":
      return on ? "Added to favourites" : "Removed from favourites";
  }
}
