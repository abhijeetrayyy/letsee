/**
 * Seen at the cinema, near you (docs/IDEAS_2026-10.md §6.3): titles people
 * logged at the cinema in the last thirty days — by people whose own watch
 * region is yours when you have one, anyone's otherwise — most people first,
 * then most recent. One person's night out counts.
 */
type Person = { id: string; username: string; avatarUrl: string | null };
export type CinemaTitle = { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null; people: Person[] };

export function cinemaShelf(
  viewings: { user_id: string; item_id: string; item_type: string; watched_on: string; place?: string | null }[],
  people: Map<string, Person>,
  titles: Map<string, { name: string; image: string | null }>,
  regionOf: Map<string, string>,
  mine: string,
  since: string,
  max = 12,
): CinemaTitle[] {
  const at = new Map<string, CinemaTitle & { last: string }>();
  for (const v of viewings) {
    if (v.place !== "cinema" || v.watched_on < since) continue;
    if (mine && regionOf.get(v.user_id) !== mine) continue;
    const person = people.get(v.user_id);
    const type: "movie" | "tv" = v.item_type === "tv" ? "tv" : "movie";
    const key = `${type}:${v.item_id}`;
    const t = titles.get(key);
    if (!person || !t) continue;
    const entry: CinemaTitle & { last: string } = at.get(key) ?? { itemId: v.item_id, itemType: type, itemName: t.name, imageUrl: t.image, people: [], last: v.watched_on };
    if (!entry.people.some((p) => p.id === person.id)) entry.people.push(person);
    if (v.watched_on > entry.last) entry.last = v.watched_on;
    at.set(key, entry);
  }
  return [...at.values()]
    .sort((a, b) => b.people.length - a.people.length || b.last.localeCompare(a.last))
    .slice(0, max)
    .map(({ last: _last, ...t }) => t);
}
