/**
 * Hiding something in a room, for yourself (migration 104): which events are
 * hidden, by key. Plain functions, tested (tests/unit/room-hidden.test.ts).
 */
export type HiddenKind = "message" | "together" | "pass";

export const hiddenKey = (kind: HiddenKind, id: string | number) => `${kind}:${id}`;

type EventLike =
  | { kind: "message"; message: { id: string } }
  | { kind: "together"; together: { viewingId: number } }
  | { kind: "pass"; pass: { id: number } };

/** The kind and id a timeline item is stored under. */
export function eventRef(item: EventLike): { kind: HiddenKind; id: string } {
  if (item.kind === "message") return { kind: "message", id: item.message.id };
  if (item.kind === "together") return { kind: "together", id: String(item.together.viewingId) };
  return { kind: "pass", id: String(item.pass.id) };
}

/** The timeline without what you hid, and how many were hidden. */
export function withoutHidden<T extends EventLike>(items: T[], hidden: Set<string>): { shown: T[]; hiddenCount: number } {
  const shown = items.filter((i) => {
    const r = eventRef(i);
    return !hidden.has(hiddenKey(r.kind, r.id));
  });
  return { shown, hiddenCount: items.length - shown.length };
}
