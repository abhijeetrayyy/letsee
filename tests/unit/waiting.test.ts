import { describe, expect, it } from "vitest";
import { gatherWaiting, moreWords, waitingSentence, waitingTail, waitingWords, type WaitingItem } from "@/lib/people/waiting";
import type { RoomSummary } from "@/lib/db/rooms";

const priya = { id: "p", username: "priya", avatarUrl: null };
const sam = { id: "s", username: "sam", avatarUrl: null };
const jojo = { id: "j", username: "jojo", avatarUrl: null };

const room = (person: typeof priya, over: Partial<RoomSummary> = {}): RoomSummary => ({
  person,
  lastAt: "2026-10-12T10:00:00Z",
  last: { kind: "message", text: "hey", fromMe: false },
  unread: true,
  together: 0,
  lastTogether: null,
  passes: 0,
  lastPass: null,
  lastMessage: "2026-10-12T10:00:00Z",
  mutual: true,
  ...over,
});

const base = {
  requests: [
    { kind: "was-there" as const, viewingId: 7, person: priya, itemId: "1", itemType: "movie" as const, itemName: "Dune", watchedOn: "2026-10-10", at: "2026-10-11T09:00:00Z" },
    { kind: "follow" as const, id: 3, person: jojo, at: "2026-10-09T09:00:00Z" },
  ],
  passesToMe: [
    { id: 9, fromMe: false, itemId: "2", itemType: "movie" as const, itemName: "Aftersun", imageUrl: null, note: null, at: "2026-10-12T08:00:00Z", watchedAt: null, dismissedAt: null, person: sam },
  ],
  rooms: [room(sam, { lastMessage: "2026-10-12T11:00:00Z" })],
  asks: [
    { id: 4, question: "Something for a rainy Sunday?", createdAt: "2026-10-10T12:00:00Z", closesAt: "2026-10-17T12:00:00Z", by: jojo, answered: 0 },
    { id: 5, question: "Already answered", createdAt: "2026-10-12T12:00:00Z", closesAt: "2026-10-19T12:00:00Z", by: priya, answered: 1 },
  ],
};

describe("waiting for you", () => {
  it("gathers every kind, newest first", () => {
    expect(gatherWaiting(base).map((w) => w.key)).toEqual(["ms", "p9", "w7", "a4", "f3"]);
  });

  it("leaves out an ask you've answered, and rooms with nothing unread", () => {
    const items = gatherWaiting({ ...base, rooms: [room(sam, { unread: false }), room(jojo, { lastMessage: null, unread: false })] });
    expect(items.some((w) => w.kind === "message")).toBe(false);
    expect(items.some((w) => w.key === "a5")).toBe(false);
  });

  it("keeps an unread message even when something newer of yours is the room's last line", () => {
    const items = gatherWaiting({ ...base, rooms: [room(priya, { last: { kind: "together", text: "Dune", fromMe: true } })] });
    expect(items.some((w) => w.key === "mp")).toBe(true);
  });

  it("says each one by name", () => {
    const say = (w: WaitingItem) => {
      const x = waitingWords(w);
      return `${x.before ?? ""}${x.name}${x.after}${x.title ?? ""}${waitingTail(w)}`;
    };
    expect(gatherWaiting(base).map(say)).toEqual([
      "a message from sam",
      "sam passed you Aftersun",
      "priya says you watched Dune together",
      "jojo asked “Something for a rainy Sunday?”",
      "jojo would like to follow you",
    ]);
  });

  it("clips a long question", () => {
    const [ask] = gatherWaiting({ ...base, requests: [], passesToMe: [], rooms: [], asks: [{ ...base.asks[0], question: "Something long and slow and beautiful for a whole rainy Sunday afternoon with tea" }] });
    expect(waitingWords(ask).after.length).toBeLessThan(60);
    expect(waitingWords(ask).after).toMatch(/…”$/);
  });

  it("shows three and says the rest in words", () => {
    const { shown, more } = waitingSentence(gatherWaiting(base));
    expect(shown).toHaveLength(3);
    expect(more).toBe(2);
    expect(moreWords(more)).toBe("two more");
    expect(moreWords(14)).toBe("14 more");
    expect(waitingSentence([]).more).toBe(0);
  });
});
