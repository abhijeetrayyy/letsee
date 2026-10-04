/**
 * The decisions Home makes, as plain functions (docs/design/RETHINK.md §3d).
 * Everything here runs on the device's clock and the viewer's own data.
 */
import type { PersonViewing, PersonWatching } from "@/lib/db/peopleActivity";

export type DayPart = "evening" | "morning" | "day";

/** Evening is 17:00–23:59; the morning after is 05:00–11:59. */
export function dayPartOf(hour: number): DayPart {
  if (hour >= 17) return "evening";
  if (hour >= 5 && hour < 12) return "morning";
  return "day";
}

function dayDiff(day: string, now: Date): number {
  const [y, m, d] = day.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - then) / 864e5);
}

/**
 * "today", "last night", "on Tuesday" within the week; past that, the date
 * ("on 12 Aug", with the year once it isn't this one) — a weekday alone would
 * claim a log from two months ago happened this week.
 */
export function whenWatched(day: string, now = new Date()): string {
  const diff = dayDiff(day, now);
  if (diff <= 0) return "today";
  if (diff === 1) return "last night";
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (diff < 7) return `on ${date.toLocaleDateString("en-GB", { weekday: "long" })}`;
  return `on ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(y !== now.getFullYear() ? { year: "numeric" } : {}) })}`;
}

/**
 * One line a person wrote with their own actions. In order: something they
 * watched in the last three days, films they passed you, what they are
 * watching, anything else they watched this week.
 */
export function personLine(
  userId: string,
  viewings: PersonViewing[],
  watching: PersonWatching[],
  passedYou: { itemName: string }[],
  now = new Date(),
): string | null {
  const theirs = viewings.filter((v) => v.userId === userId);
  const recent = theirs.find((v) => dayDiff(v.watchedOn, now) <= 2);
  if (recent) return `watched ${recent.itemName} ${whenWatched(recent.watchedOn, now)}`;
  if (passedYou.length === 1) return `passed you ${passedYou[0].itemName}`;
  if (passedYou.length > 1) return `passed you ${passedYou.length} films`;
  const now_ = watching.find((w) => w.userId === userId);
  if (now_) return `watching ${now_.itemName}`;
  if (theirs[0]) return `watched ${theirs[0].itemName} ${whenWatched(theirs[0].watchedOn, now)}`;
  return null;
}

export type WeekGroup = {
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  userIds: string[];
  latest: string;
};

/** Your people's week, one entry per title, newest first; several people on one film are one entry. */
export function groupWeek(viewings: PersonViewing[]): WeekGroup[] {
  const groups = new Map<string, WeekGroup>();
  for (const v of viewings) {
    const key = `${v.itemType}:${v.itemId}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, { itemId: v.itemId, itemType: v.itemType, itemName: v.itemName, imageUrl: v.imageUrl, userIds: [v.userId], latest: v.watchedOn });
    } else {
      if (!g.userIds.includes(v.userId)) g.userIds.push(v.userId);
      if (v.watchedOn > g.latest) g.latest = v.watchedOn;
      g.imageUrl ??= v.imageUrl;
    }
  }
  return [...groups.values()].sort((a, b) => b.latest.localeCompare(a.latest));
}

/** "Priya", "Priya and Kabir", "Priya, Kabir and 2 more". */
export function names(list: string[]): string {
  if (list.length <= 1) return list[0] ?? "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]} and ${list.length - 2} more`;
}
