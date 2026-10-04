/**
 * The morning after (docs/design/RETHINK.md §3d): logs are most often lost the
 * morning after, so Home asks about last night's open intent while the memory
 * is fresh.
 *
 * "A title you opened" last evening is remembered on this device only, in
 * localStorage, by the title page itself. Nothing is sent anywhere: it is the
 * cheapest possible record of an intent, and it is nobody else's business.
 */
export type Opened = { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null; at: string };

const OPENED = "letsee:opened";
const ANSWERED = "letsee:last-night-answered";
const KEEP = 12;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the morning card simply doesn't appear.
  }
}

/** Called by a title page. Only evenings count; a lunchtime browse is not an intent. */
export function rememberOpened(title: Omit<Opened, "at">, now = new Date()) {
  if (now.getHours() < 17) return;
  const list = read<Opened[]>(OPENED, []).filter((o) => !(o.itemId === title.itemId && o.itemType === title.itemType));
  write(OPENED, [{ ...title, at: now.toISOString() }, ...list].slice(0, KEEP));
}

/** The title opened most recently between 17:00 yesterday and 05:00 today, unless already answered. */
export function lastNightIntent(now = new Date()): Opened | null {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 17).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 5).getTime();
  const answered = new Set(read<string[]>(ANSWERED, []));
  return (
    read<Opened[]>(OPENED, []).find((o) => {
      const t = new Date(o.at).getTime();
      return t >= start && t < end && !answered.has(`${o.itemType}:${o.itemId}:${o.at.slice(0, 10)}`);
    }) ?? null
  );
}

export function answerLastNight(o: Opened) {
  const answered = read<string[]>(ANSWERED, []);
  write(ANSWERED, [`${o.itemType}:${o.itemId}:${o.at.slice(0, 10)}`, ...answered].slice(0, 30));
}
