/**
 * Waiting for you: the things only you can resolve, by name, in one sentence
 * at the top of Home (docs/IDEAS_2026-10.md §5.1).
 *
 * Five kinds, all already read for Home (the room list and the asks), so the
 * sentence costs nothing: someone says you watched a title together, someone
 * would like to follow you, someone passed you a title, someone asked your
 * people for a film and you haven't answered, and a message you haven't read.
 * Newest first. Finite — never a count on a badge, never a red dot; when
 * there's nothing, it says so.
 */
import type { Pass, Request, RoomPerson, RoomSummary } from "@/lib/db/rooms";
import type { AskForMe } from "@/lib/db/asks";

export type WaitingItem =
  | { kind: "was-there"; key: string; person: RoomPerson; itemName: string; at: string }
  | { kind: "follow"; key: string; person: RoomPerson; at: string }
  | { kind: "pass"; key: string; person: RoomPerson; itemId: string; itemType: "movie" | "tv"; itemName: string; at: string }
  | { kind: "ask"; key: string; person: RoomPerson; question: string; at: string }
  | { kind: "message"; key: string; person: RoomPerson; at: string };

export function gatherWaiting({
  requests,
  passesToMe,
  rooms,
  asks,
}: {
  requests: Request[];
  passesToMe: (Pass & { person: RoomPerson })[];
  rooms: RoomSummary[];
  asks: AskForMe[];
}): WaitingItem[] {
  const items: WaitingItem[] = [
    ...requests.map((r): WaitingItem =>
      r.kind === "follow"
        ? { kind: "follow", key: `f${r.id}`, person: r.person, at: r.at }
        : { kind: "was-there", key: `w${r.viewingId}`, person: r.person, itemName: r.itemName, at: r.at },
    ),
    ...passesToMe.map((p): WaitingItem => ({ kind: "pass", key: `p${p.id}`, person: p.person, itemId: p.itemId, itemType: p.itemType, itemName: p.itemName, at: p.at })),
    // An ask you've answered isn't waiting on you any more, even if you could add another.
    ...asks.filter((a) => a.answered === 0).map((a): WaitingItem => ({ kind: "ask", key: `a${a.id}`, person: a.by, question: a.question, at: a.createdAt })),
    // A room with a message from them you haven't read ("unread" counts only
    // theirs) — even if something newer, like a film you logged together, is
    // the room's last line.
    ...rooms
      .filter((r) => r.unread && r.lastMessage)
      .map((r): WaitingItem => ({ kind: "message", key: `m${r.person.id}`, person: r.person, at: r.lastMessage! })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** One item as words: the name first, then what they're waiting on. */
export function waitingWords(item: WaitingItem): { name: string; before?: string; after: string; title?: string } {
  switch (item.kind) {
    case "was-there":
      return item.itemName ? { name: item.person.username, after: " says you watched ", title: item.itemName } : { name: item.person.username, after: " says you watched something together" };
    case "follow":
      return { name: item.person.username, after: " would like to follow you" };
    case "pass":
      return { name: item.person.username, after: " passed you ", title: item.itemName };
    case "ask":
      return { name: item.person.username, after: ` asked “${clip(item.question, 40)}”` };
    case "message":
      return { before: "a message from ", name: item.person.username, after: "" };
  }
}

/** "together" closes a was-there with a title. */
export function waitingTail(item: WaitingItem): string {
  return item.kind === "was-there" && item.itemName ? " together" : "";
}

/** The first few, and how many more — said in words, not shown as a badge. */
export function waitingSentence(items: WaitingItem[], max = 3): { shown: WaitingItem[]; more: number } {
  return { shown: items.slice(0, max), more: Math.max(0, items.length - max) };
}

export function moreWords(n: number): string {
  const words = ["", "one more", "two more", "three more", "four more", "five more", "six more", "seven more", "eight more", "nine more"];
  return words[n] ?? `${n} more`;
}

/** Shorten at a word, not through one. */
function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}
