/**
 * Episode reactions (docs/IDEAS_2026-10.md §4.1): a line in a room about one
 * episode, closed for the other person until they've reached it.
 *
 * Stored as an ordinary message — no new table — with its words in
 * `metadata.text` and a safe line in `content`: "Reacted to Severance
 * S02·E04". Everything that previews a message (the People list's last line,
 * a room summary) reads `content`, so the words never leak ahead of the
 * episode; only the room opens them, and only once you've caught up (or
 * chosen "show anyway"). TV Time had this; nobody rebuilt it.
 */
import { episodeLabel } from "@/lib/logging/episodes";

export type EpisodeRef = { show_id: string; show_name: string; show_image: string | null; s: number; e: number };

/** What a reaction's `content` says, everywhere that isn't the room. */
export function reactionPreview(ep: EpisodeRef): string {
  return `Reacted to ${ep.show_name} ${episodeLabel({ s: ep.s, e: ep.e })}`;
}

/** The room's address carries the episode: `?about=95396:2:4&title=Severance&poster=/x.jpg`. */
export function aboutQuery(ep: EpisodeRef): string {
  const q = new URLSearchParams({ about: `${ep.show_id}:${ep.s}:${ep.e}`, title: ep.show_name });
  if (ep.show_image) q.set("poster", ep.show_image);
  return q.toString();
}

export function parseAbout(params: URLSearchParams): EpisodeRef | null {
  const m = /^(\d+):(\d+):(\d+)$/.exec(params.get("about") ?? "");
  const title = (params.get("title") ?? "").trim().slice(0, 200);
  if (!m || !title) return null;
  const [, show, s, e] = m;
  if (Number(s) < 1 || Number(e) < 1) return null;
  return { show_id: show, show_name: title, show_image: params.get("poster") || null, s: Number(s), e: Number(e) };
}

/** A message's episode, if it is a reaction (and well formed). */
export function reactionOf(metadata: unknown): (EpisodeRef & { text: string }) | null {
  const m = metadata as { episode?: Partial<EpisodeRef>; text?: unknown } | null;
  const ep = m?.episode;
  if (!ep || typeof m?.text !== "string" || !ep.show_id || !ep.show_name || !Number.isInteger(ep.s) || !Number.isInteger(ep.e)) return null;
  return { show_id: String(ep.show_id), show_name: String(ep.show_name), show_image: ep.show_image ?? null, s: Number(ep.s), e: Number(ep.e), text: m.text };
}
