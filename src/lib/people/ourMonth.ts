/**
 * Our month (docs/IDEAS_2026-10.md §3.3): a room's month, for two — the films
 * you watched together and what you passed each other. Which month: this one,
 * unless it's the first week and last month had something (then that's the
 * recap worth sharing). Built from what the room already read; no new reads.
 */
type Together = { viewingId: number; itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null; watchedOn: string };
type Pass = { id: number; fromMe: boolean; itemName: string; imageUrl: string | null; at: string };

export type RoomMonth = { month: string; label: string; films: Together[]; passes: Pass[] };

const monthOf = (day: string) => day.slice(0, 7);

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
}

function gather(month: string, together: Together[], passes: Pass[]): RoomMonth | null {
  const films = together.filter((t) => monthOf(t.watchedOn) === month).sort((a, b) => a.watchedOn.localeCompare(b.watchedOn));
  const passed = passes.filter((p) => monthOf(p.at.slice(0, 10)) === month);
  return films.length || passed.length ? { month, label: monthLabel(month), films, passes: passed } : null;
}

/** The month a room shows: last month in the first week (if it had anything), else this one. */
export function pickRoomMonth(together: Together[], passes: Pass[], today: string): RoomMonth | null {
  const [y, m, d] = today.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  if (d <= 7) {
    const last = gather(prev, together, passes);
    if (last) return last;
  }
  return gather(monthOf(today), together, passes);
}

/** "3 films together · 2 passed" */
export function roomMonthLine(m: RoomMonth): string {
  const films = m.films.length ? `${m.films.length} ${m.films.length === 1 ? "film" : "films"} together` : null;
  const passed = m.passes.length ? `${m.passes.length} passed` : null;
  return [films, passed].filter(Boolean).join(" · ");
}
