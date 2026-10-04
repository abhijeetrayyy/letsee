"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, LoaderCircle } from "lucide-react";
import Link from "@components/ui/AppLink";
import { LogCheck } from "@components/ds/LogItButton";
import { whenLabel, type Save } from "@/lib/people/lanes";
import { todayIso } from "@/utils/viewings";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * The two rows Up next is made of — a save with its one-tap log, and a show
 * with its next episode — shared with the Log it sheet in the bars, so the
 * same title looks and behaves the same in both. Both read the same SWR keys
 * (`["saves", me, region]`, `/api/continue-watching`).
 */
export type Episode = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  next_season: number | null;
  next_episode: number | null;
  is_caught_up: boolean;
  up_next: { s: number; e: number }[];
  can_mark_next: boolean;
  waiting: boolean;
  waiting_label: string | null;
};

export const episodesFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : { items: [] }));

export function SaveRow({ save, done, onDone }: { save: Save; done: boolean; onDone: (on: boolean) => void }) {
  const href = titlePath(save.itemType, save.itemId, save.itemName);
  const who = save.withPerson?.username ?? save.withName;
  const meta = [
    done ? "Logged today" : whenLabel(save, todayIso()),
    who ? `from ${who}` : null,
    save.leaving ? `leaves ${save.leaving.provider} ${new Date(`${save.leaving.on}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : null,
  ].filter(Boolean);
  return (
    <li className={`flex items-center gap-3.5 py-2.5 transition-opacity ${done ? "opacity-60" : ""}`}>
      <Link href={href} aria-label={`Open ${save.itemName}`} className="shrink-0">
        <img src={getPosterUrl(save.imageUrl, "w92")} alt="" loading="lazy" className="aspect-2/3 w-12 rounded-media bg-hover object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate font-display text-base text-ink-0 hover:underline">
          {save.itemName}
        </Link>
        {meta.length > 0 && <p className="truncate text-xs text-ink-500">{meta.join(" · ")}</p>}
        {save.note && <p className="truncate font-display text-sm italic text-ink-400">“{save.note}”</p>}
      </div>
      <LogCheck
        title={{ itemId: save.itemId, itemType: save.itemType, itemName: save.itemName, imageUrl: save.imageUrl, genres: save.genres }}
        onLogged={() => onDone(true)}
        onUndone={() => onDone(false)}
      />
    </li>
  );
}

export function EpisodeRow({
  episode,
  all,
  onMarked,
  onFailed,
  onSaved,
}: {
  episode: Episode;
  all: Episode[];
  onMarked: (next: { items: Episode[] }) => void;
  onFailed: () => void;
  /**
   * After the write lands: refetch. The optimistic step only shifts the list
   * it has (the server sends six at most) and can't know whether the new next
   * episode has aired, so the server's answer replaces it.
   */
  onSaved?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const next = episode.up_next?.[0];
  const href = titlePath("tv", episode.show_id, episode.show_name);

  // The bulk route upserts, so a double tap or a retry can never un-mark an
  // episode (see ContinueWatchingProgress); the advance is optimistic.
  const markNext = async () => {
    if (!next || busy) return;
    setBusy(true);
    onMarked({
      items: all.map((i) =>
        i.show_id === episode.show_id
          ? { ...i, up_next: i.up_next.slice(1), next_season: i.up_next[1]?.s ?? null, next_episode: i.up_next[1]?.e ?? null, is_caught_up: i.up_next.length <= 1 }
          : i,
      ),
    });
    const res = await fetch("/api/watched-episodes-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: episode.show_id, episodes: [{ season_number: next.s, episode_number: next.e }], action: "mark" }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      onFailed();
      toast.error("That didn't save. Check your connection.");
      return;
    }
    onSaved?.();
  };

  const label = episode.is_caught_up
    ? episode.waiting_label ?? "Caught up"
    : next
      ? `S${String(next.s).padStart(2, "0")} · E${String(next.e).padStart(2, "0")} next`
      : episode.waiting_label;

  return (
    <li className="flex items-center gap-3.5 py-2.5">
      <Link href={href} aria-label={`Open ${episode.show_name}`} className="shrink-0">
        <img src={getPosterUrl(episode.poster_path, "w92")} alt="" loading="lazy" className="aspect-2/3 w-12 rounded-media bg-hover object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate font-display text-base text-ink-0 hover:underline">
          {episode.show_name}
        </Link>
        {label && <p className="font-mono text-xs uppercase tracking-wide text-ink-500">{label}</p>}
      </div>
      {episode.can_mark_next && next && !episode.is_caught_up && (
        <button
          type="button"
          onClick={markNext}
          disabled={busy}
          aria-label={`Mark season ${next.s} episode ${next.e} of ${episode.show_name} watched`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
        </button>
      )}
    </li>
  );
}

