/**
 * A diary entry as a stub — the words on the picture (ds/StubPicture,
 * docs/IDEAS_2026-10.md §3.1). Plain functions, tested.
 *
 * The stub is the unit of a letsee diary: a day, where you were, who was
 * there, your stars and a line. As a picture it travels where letsee doesn't
 * — a story, a group chat — and every one is a person, not a grid.
 */
import { scoreToStars } from "@/utils/ratingScale";

/** "★★★★½" for a stored score; empty for none. */
export function starGlyphs(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "";
  const stars = scoreToStars(score);
  const whole = Math.floor(stars);
  return "★".repeat(whole) + (stars - whole >= 0.5 ? "½" : "");
}

/** "SAT 11 OCT 2026" — always with the year: a stub is kept. */
export function stubDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  return date
    .toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .replace(/,/g, "")
    .toUpperCase();
}

export function stubPlace(place: string | null | undefined): string {
  return place === "cinema" ? "At the cinema" : place === "other" ? "Somewhere else" : "At home";
}

/** "with Priya", "with Priya and Sam", "with Priya, Sam and 2 more". */
export function stubWith(names: string[]): string {
  const n = names.filter(Boolean);
  if (!n.length) return "";
  if (n.length === 1) return `with ${n[0]}`;
  if (n.length === 2) return `with ${n[0]} and ${n[1]}`;
  if (n.length === 3) return `with ${n[0]}, ${n[1]} and ${n[2]}`;
  return `with ${n[0]}, ${n[1]} and ${n.length - 2} more`;
}

/** Their words, kept to what a picture can hold — cut at a word. */
export function stubWords(words: string | null | undefined, max = 160): string {
  const t = (words ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

/** A sharper poster for the picture: TMDB's w500 in place of whatever size was stored. */
export function stubPoster(url: string): string {
  return url.replace(/\/t\/p\/w\d+\//, "/t/p/w500/");
}
