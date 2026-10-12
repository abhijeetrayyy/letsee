/**
 * Sets (docs/IDEAS_2026-10.md §2.1): a bounded set you chose to work through
 * — a list, or a person's work in one role. Plain functions, tested.
 *
 * Progress is pace, not deficit: "7 of 12 · 3 this year", and a quiet line
 * when it's done. Nothing is lost when it lapses. Company, not rank: who else
 * is on it, by name, with theirs.
 */
export type SetKind = "list" | "person";
export type SetRole = "director" | "creator" | "actor";
export type SetRef = { kind: SetKind; refId: string; role: SetRole | null };
export type SetRow = SetRef & { id: number; userId: string; name: string; imageUrl: string | null; createdAt: string };
export type SetItem = { id: string; type: "movie" | "tv" };

export const setKey = (r: SetRef) => `${r.kind}:${r.refId}:${r.role ?? ""}`;

/** What the set is, in a few words: "Directed by Christopher Nolan", "A list by sam". */
export function setLabel(row: { kind: SetKind; role: SetRole | null; name: string }, owner?: string | null): string {
  if (row.kind === "list") return owner ? `A list by ${owner}` : "A list";
  return row.role === "director" ? "Directed by" : row.role === "creator" ? "Created by" : "Starring";
}

/** Which of a person's work a set is, from what the person-work route returns. */
export function personSetItems(
  role: SetRole,
  work: { directed: { id: number; type: "movie" | "tv"; upcoming: boolean }[]; created: { id: number; type: "movie" | "tv"; upcoming: boolean }[]; acted: { id: number; type: "movie" | "tv"; upcoming: boolean }[] },
): SetItem[] {
  const list = role === "director" ? work.directed : role === "creator" ? work.created : work.acted;
  // Out already: a set is what you can watch.
  return list.filter((w) => !w.upcoming).map((w) => ({ id: String(w.id), type: w.type }));
}

/** "7 of 12 · 3 this year" — or the quiet line once it's all done. */
export function setLine(p: { done: number; total: number; thisYear: number }): string {
  if (p.total > 0 && p.done >= p.total) return `Every one of them · ${p.total} of ${p.total}`;
  const pace = p.thisYear > 0 ? ` · ${p.thisYear} this year` : "";
  return `${p.done} of ${p.total}${pace}`;
}

/** The role a person's set should default to, from what they're known for. */
export function roleFor(department: string | null | undefined, has: { directed: number; created: number }): SetRole {
  if (department === "Directing" && has.directed > 0) return "director";
  if ((department === "Writing" || department === "Production" || department === "Creator") && has.created > 0) return "creator";
  if (department && department !== "Acting" && has.directed > 0) return "director";
  return "actor";
}
