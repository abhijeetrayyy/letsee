/**
 * Where two people meet, in films (docs/design/RETHINK.md §4, "Where you
 * meet"): two or three titles you both loved, and one you split on, asked as
 * a question. Never a percentage — a match score turns a friend into a
 * statistic, and a single film you disagree about is a conversation.
 *
 * Scores are out of 10, stored as `user_ratings.score`; 9 and 10 are ★4½ and
 * ★5.
 */
export type Rating = { key: string; score: number; at: string };
export type Moment = { kind: "both" | "split"; key: string; mine: number; theirs: number };

const LOVED = 9;
const SPLIT = 5;

export function pickMoments(mine: Rating[], theirs: Rating[], max = { both: 2, split: 1 }): Moment[] {
  const mineByKey = new Map(mine.map((r) => [r.key, r]));
  const both: (Moment & { at: string })[] = [];
  const split: (Moment & { at: string })[] = [];
  for (const t of theirs) {
    const m = mineByKey.get(t.key);
    if (!m) continue;
    const at = m.at > t.at ? m.at : t.at;
    if (m.score >= LOVED && t.score >= LOVED) both.push({ kind: "both", key: t.key, mine: m.score, theirs: t.score, at });
    else if (Math.abs(m.score - t.score) >= SPLIT) split.push({ kind: "split", key: t.key, mine: m.score, theirs: t.score, at });
  }
  both.sort((a, b) => b.mine + b.theirs - (a.mine + a.theirs) || b.at.localeCompare(a.at));
  split.sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs) || b.at.localeCompare(a.at));
  return [...both.slice(0, max.both), ...split.slice(0, max.split)].map(({ kind, key, mine: m, theirs: t }) => ({ kind, key, mine: m, theirs: t }));
}

/** 10 → "★5", 9 → "★4½". */
export function stars(score: number): string {
  const whole = Math.floor(score / 2);
  return `★${whole || ""}${score % 2 ? "½" : ""}`;
}

/* ── Where your lists meet ── */

export type ListTitle = { itemId: string; itemType: "movie" | "tv"; itemName: string; imageUrl: string | null };
export type ListMeet = ListTitle & { kind: "both" | "they-saw" | "you-saw" };

/**
 * The overlap between two people's lists that a room can do something with:
 * what you both want to see (a night together, already agreed), what they've
 * seen of yours (ask them), what you've seen of theirs (tell them). In that
 * order, a title once, at most `max`. `theySaw` and `youSaw` are the keys
 * (`type:id`) of the saves the other side has watched.
 */
export function listsMeet(
  mySaves: ListTitle[],
  theirSaves: ListTitle[],
  theySaw: Set<string>,
  youSaw: Set<string>,
  max = 12,
): ListMeet[] {
  const k = (t: ListTitle) => `${t.itemType}:${t.itemId}`;
  const theirs = new Set(theirSaves.map(k));
  const out: ListMeet[] = [];
  const seen = new Set<string>();
  const add = (t: ListTitle, kind: ListMeet["kind"]) => {
    if (seen.has(k(t)) || out.length >= max) return;
    seen.add(k(t));
    out.push({ ...t, kind });
  };
  for (const t of mySaves) if (theirs.has(k(t))) add(t, "both");
  for (const t of mySaves) if (theySaw.has(k(t))) add(t, "they-saw");
  for (const t of theirSaves) if (youSaw.has(k(t))) add(t, "you-saw");
  return out;
}
