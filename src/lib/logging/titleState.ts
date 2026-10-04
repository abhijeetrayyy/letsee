/**
 * Where you stand with a title, and what the page offers you because of it —
 * as plain functions, so every combination is tested rather than discovered
 * (docs/design/RETHINK.md §8, "Logging and the diary").
 *
 * The model, in four rules:
 *
 * 1. **Logging is the only way to say you watched something.** One tap logs a
 *    dated viewing; the title's status follows from it. "Watched" is never a
 *    status you pick from a menu — that path used to create a viewing on the
 *    side, which is how a page ended up with three different ways to log.
 * 2. **Saving is for things you haven't watched.** Status is one column, so
 *    saving a watched film would overwrite "watched". Once you have logged a
 *    title, its primary action becomes *Log again* (a rewatch) and Save goes.
 * 3. **A series in progress stays in progress.** Logging a viewing of a show
 *    you are watching (or paused on) does not claim you finished it; the
 *    server keeps the status, and so does this model.
 * 4. **Undo puts back exactly what was there.**
 *
 * The words people see are the four in RETHINK.md: *Want to watch*,
 * *Watching*, *Watched*, *Stopped* (on hold and dropped both read Stopped).
 */
export type Kind = "movie" | "tv";
export type Status = "watchlist" | "watching" | "watched" | "on_hold" | "dropped" | null;

export type TitleState = {
  kind: Kind;
  status: Status;
  /** Your viewings of it, any order; `watchedOn` is yyyy-mm-dd. */
  viewings: { watchedOn: string }[];
};

export function statusWord(status: Status): string | null {
  switch (status) {
    case "watchlist":
      return "Want to watch";
    case "watching":
      return "Watching";
    case "watched":
      return "Watched";
    case "on_hold":
    case "dropped":
      return "Stopped";
    default:
      return null;
  }
}

/** Has this person watched it at all — by status, or by any logged viewing. */
export function hasWatched(s: TitleState): boolean {
  return s.status === "watched" || s.viewings.length > 0;
}

/** The one primary action: Log it, or Log again once there is a viewing. */
export function primaryAction(s: TitleState): { label: "Log it" | "Log again"; rewatch: boolean } {
  return hasWatched(s) ? { label: "Log again", rewatch: true } : { label: "Log it", rewatch: false };
}

/**
 * Save (to Up next) — offered only before you have watched it, and for a
 * series only when it isn't already in progress (Watching is its own state).
 */
export function saveAction(s: TitleState): { show: boolean; saved: boolean } {
  if (s.status === "watchlist") return { show: true, saved: true };
  if (hasWatched(s)) return { show: false, saved: false };
  if (s.kind === "tv" && (s.status === "watching" || s.status === "on_hold" || s.status === "dropped")) return { show: false, saved: false };
  return { show: true, saved: false };
}

/**
 * The statuses you may choose by hand. Never "watched" — that comes from a
 * log. A film is either something you want to watch or nothing; a series can
 * also be in progress or stopped.
 */
export function statusChoices(kind: Kind): Exclude<Status, "watched" | "dropped" | null>[] {
  return kind === "tv" ? ["watchlist", "watching", "on_hold"] : ["watchlist"];
}

/**
 * The one status change the title's "more" menu offers, if any. Everything
 * else already has a home: wanting to watch is the Save button, watched comes
 * from a log, and a series starts by ticking an episode. What's left is a
 * series you're on (stop it) or one you stopped (pick it back up).
 */
export function menuStatus(kind: Kind, status: Status): { label: string; to: Exclude<Status, null> } | null {
  if (kind !== "tv") return null;
  if (status === "watching") return { label: "Stop watching", to: "on_hold" };
  if (status === "on_hold" || status === "dropped") return { label: "Resume watching", to: "watching" };
  return null;
}

/** What a log does to the status — the same rule `/api/viewings` applies. */
export function statusAfterLog(kind: Kind, prev: Status): Status {
  if (kind === "tv" && (prev === "watching" || prev === "on_hold")) return prev;
  return "watched";
}

/**
 * What Undo must restore. `null` means the title had no status and the row
 * should go back to having none; "watched" means nothing to restore.
 */
export function statusToRestore(prev: Status): { restore: boolean; status: Status } {
  return prev === "watched" ? { restore: false, status: "watched" } : { restore: true, status: prev };
}

function dayDiff(day: string, today: string): number {
  const toUtc = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((toUtc(today) - toUtc(day)) / 864e5);
}

/** "today", "yesterday", "Fri 14 Mar", "14 Mar 2024". */
export function dayWords(day: string, today: string): string {
  const diff = dayDiff(day, today);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: sameYear ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

/**
 * One quiet line under the actions saying where you stand: "Watched
 * yesterday", "Watched 3 times · last Fri 14 Mar", "Watching", "Want to
 * watch", "Stopped". Nothing when there is nothing.
 */
export function stateLine(s: TitleState, today: string): string | null {
  if (s.viewings.length > 0) {
    const last = s.viewings.map((v) => v.watchedOn).sort().at(-1)!;
    const when = dayWords(last, today);
    const prefix = s.kind === "tv" && (s.status === "watching" || s.status === "on_hold") ? `${statusWord(s.status)} · logged` : "Watched";
    return s.viewings.length === 1 ? `${prefix} ${when}` : `${prefix} ${s.viewings.length} times · last ${when}`;
  }
  return statusWord(s.status);
}
