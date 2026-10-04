/**
 * Up next's lanes, as plain functions (docs/design/PAGES.md §3): Tonight,
 * Lined up, Someday. A plan whose date has gone by drops back to Someday
 * rather than sitting there as a reproach.
 */
import type { RoomPerson } from "@/lib/db/rooms";

export type SaveFor = "tonight" | "weekend" | "someday" | "date" | null;

export type Save = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  genres: string[];
  savedAt: string | null;
  note: string | null;
  saveFor: SaveFor;
  saveForDate: string | null;
  withPerson: RoomPerson | null;
  withName: string | null;
  leaving: { provider: string; on: string } | null;
};

export type Lane = "tonight" | "lined-up" | "someday";

/** Tonight is tonight or today's date; a weekend or a future date is lined up; everything else, and any date gone by, is someday. */
export function laneOf(save: Pick<Save, "saveFor" | "saveForDate">, today: string): Lane {
  if (save.saveFor === "tonight") return "tonight";
  if (save.saveFor === "date" && save.saveForDate) {
    if (save.saveForDate === today) return "tonight";
    return save.saveForDate > today ? "lined-up" : "someday";
  }
  if (save.saveFor === "weekend") return "lined-up";
  return "someday";
}

/** "This weekend", "Sat 11 Oct" — and "Tonight" for today's date, which is how a pick is lined up. */
export function whenLabel(save: Pick<Save, "saveFor" | "saveForDate">, today?: string): string | null {
  if (save.saveFor === "tonight") return "Tonight";
  if (save.saveFor === "date" && today && save.saveForDate === today) return "Tonight";
  if (save.saveFor === "weekend") return "This weekend";
  if (save.saveFor === "date" && save.saveForDate) {
    const [y, m, d] = save.saveForDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  }
  return null;
}

/* ── Pick one for me ── */

/**
 * Choosing from ninety saved posters is the hard part of Up next, so it can
 * choose for you. Not uniformly: a title about to leave a service you have is
 * three times as likely, one someone told you to watch twice as likely —
 * the two reasons a save has to be watched soon rather than someday. `rand`
 * is injectable so the weighting can be tested.
 */
export function pickOne<T extends Pick<Save, "itemId" | "itemType" | "leaving" | "withPerson" | "withName">>(
  saves: T[],
  skip: Set<string> = new Set(),
  rand: () => number = Math.random,
): T | null {
  const pool = saves.filter((s) => !skip.has(`${s.itemType}:${s.itemId}`));
  const from = pool.length ? pool : saves;
  if (!from.length) return null;
  const weight = (s: T) => (s.leaving ? 3 : s.withPerson || s.withName ? 2 : 1);
  const total = from.reduce((n, s) => n + weight(s), 0);
  let r = rand() * total;
  for (const s of from) {
    r -= weight(s);
    if (r < 0) return s;
  }
  return from[from.length - 1];
}

/**
 * Why this one, in a line: it's leaving, someone said so, you wrote why, or
 * it has simply waited a long time. `now` is injectable for tests.
 */
export function pickReason(
  save: Pick<Save, "leaving" | "withPerson" | "withName" | "note" | "savedAt">,
  now: Date = new Date(),
): string | null {
  if (save.leaving) {
    const on = new Date(`${save.leaving.on}T00:00:00`);
    return `Leaves ${save.leaving.provider} ${on.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }
  const who = save.withPerson?.username ?? save.withName;
  if (who) return `${who} said you should`;
  if (save.note) return `You saved it because: “${save.note}”`;
  if (!save.savedAt) return null;
  const days = Math.floor((now.getTime() - new Date(save.savedAt).getTime()) / 86_400_000);
  if (days < 1) return "Saved today";
  if (days < 14) return `Saved ${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `Saved ${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `Waiting ${Math.round(days / 30.4)} months`;
  return `Waiting since ${new Date(save.savedAt).getFullYear()}`;
}
