/**
 * A profile's *Lately*: what they've watched most recently, from both places
 * it gets written down.
 *
 * The diary (`viewings`) holds logs — a day, who was there. A mark from a
 * poster ("Watched", or "Finished" for a series) has no day and makes no
 * viewing (lib/logging/marks), so a *Lately* read from the diary alone stopped
 * moving once marks arrived: everything marked since never showed. A mark's
 * time is its status row's `updated_at` — when they said they'd seen it.
 *
 * A title in both shows once, as the log: the log has the day and the company.
 */
export type LatelyLog = {
  kind: "log";
  id: number;
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  /** The day it was watched, YYYY-MM-DD. */
  day: string;
  /** When it was logged. */
  at: string;
  rewatch: boolean;
  who: string[];
};

export type LatelyMark = {
  kind: "mark";
  itemId: string;
  itemType: "movie" | "tv";
  itemName: string;
  imageUrl: string | null;
  /** The day it was marked, in the viewer's time zone. */
  day: string;
  at: string;
};

export type LatelyEntry = LatelyLog | LatelyMark;

/** YYYY-MM-DD for a timestamp, on the viewer's calendar. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Newest day first; within a day, the later log or mark first. */
export function mergeLately(logs: LatelyLog[], marks: Omit<LatelyMark, "kind" | "day">[], limit = 6): LatelyEntry[] {
  const logged = new Set(logs.map((l) => `${l.itemType}:${l.itemId}`));
  const entries: LatelyEntry[] = [
    ...logs.filter((l) => l.itemName),
    ...marks
      .filter((m) => m.itemName && !logged.has(`${m.itemType}:${m.itemId}`))
      .map((m): LatelyMark => ({ kind: "mark", ...m, day: localDay(m.at) })),
  ];
  return entries.sort((a, b) => b.day.localeCompare(a.day) || Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
