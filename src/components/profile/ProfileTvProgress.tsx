"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import toast from "react-hot-toast";
import { Check, LoaderCircle } from "lucide-react";
import Link from "@components/ui/AppLink";
import TvCalendarView from "@components/profile/TvCalendarView";
import { swrFetcher } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { episodeLabel } from "@/lib/logging/episodes";
import { offersNextCheck, seriesLine } from "@/lib/logging/seriesProgress";

/**
 * Series progress on a profile: every show someone is inside of, as rows —
 * where they are, how far through, and (on your own profile) one check for
 * the next episode, with Undo. Filters are the words the rest of the app
 * uses (Watching · Watched · On hold · Dropped · Want to watch), not the database
 * states. Read through `/api/profile/tv-progress`, which checks visibility
 * before it reads anything.
 *
 * The episodes-by-month calendar stays one tap away for anyone who wants the
 * history rather than the shelf.
 */
const PAGE_SIZE = 20;

export type ProfileTvProgressItem = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  seasons_completed: number;
  episodes_watched: number;
  total_episodes: number;
  next_season: number | null;
  next_episode: number | null;
  all_complete: boolean;
  caught_up: boolean;
  next_air_date: string | null;
  tv_status: string | null;
};

type TvProgressPage = { items: ProfileTvProgressItem[]; total: number };

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "watching", label: "Watching" },
  { key: "watched", label: "Watched" },
  { key: "on_hold", label: "On hold" },
  { key: "dropped", label: "Dropped" },
  { key: "watchlist", label: "Want to watch" },
];

export default function ProfileTvProgress({ userId, isOwner = false }: { userId: string; isOwner?: boolean }) {
  const [filter, setFilter] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<TvProgressPage>(
    (index, previous) => {
      // Paged by the route's offset, not by how many came back: the route
      // drops a show TMDB can't describe, so a short page isn't the end.
      if (previous && index * PAGE_SIZE >= previous.total) return null;
      const status = filter ? `&status=${encodeURIComponent(filter)}` : "";
      return `/api/profile/tv-progress?userId=${encodeURIComponent(userId)}&limit=${PAGE_SIZE}&offset=${index * PAGE_SIZE}${status}`;
    },
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const items = data ? data.flatMap((p) => p.items) : [];
  const total = data?.[0]?.total ?? 0;
  const loadingMore = isValidating && size > 1;

  const toggle = (showId: string, s: number, e: number) =>
    fetch("/api/watched-episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId, seasonNumber: s, episodeNumber: e }),
    }).then((r) => r.ok, () => false);

  const markNext = async (item: ProfileTvProgressItem) => {
    if (!item.next_season || !item.next_episode || marking) return;
    const ep = { s: item.next_season, e: item.next_episode };
    setMarking(item.show_id);
    const ok = await toggle(item.show_id, ep.s, ep.e);
    if (ok) await mutate();
    setMarking(null);
    if (!ok) {
      toast.error("That didn't save. Check your connection.");
      return;
    }
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Marked {episodeLabel(ep)}
          <button
            type="button"
            className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
            onClick={async () => {
              toast.dismiss(t.id);
              if (await toggle(item.show_id, ep.s, ep.e)) await mutate();
              else toast.error("Couldn't undo that.");
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  };

  const chip = (on: boolean) =>
    `inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${
      on ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter series" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setCalendar(false);
              }}
              className={chip(filter === f.key && !calendar)}
            >
              {f.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setCalendar((v) => !v)}
          aria-expanded={calendar}
          className="text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0"
        >
          {calendar ? "Back to the shows" : "Episodes by month"}
        </button>
      </div>

      {calendar ? (
        <TvCalendarView userId={userId} isOwner={isOwner} />
      ) : isLoading ? (
        <div className="flex flex-col" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line py-2">
              <div className="h-18 w-12 rounded-media bg-raised" />
              <div className="h-4 flex-1 rounded bg-raised" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-ink-400">
          Series progress didn&apos;t load.{" "}
          <button type="button" onClick={() => void mutate()} className="font-medium text-ink-0 underline decoration-line-input underline-offset-4">
            Try again
          </button>
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-ink-500">
          {filter
            ? `Nothing under ${FILTERS.find((f) => f.key === filter)?.label ?? "that"}.`
            : isOwner
              ? "No series yet. Tick an episode on any series page and it shows up here."
              : "No series yet."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col">
            {items.map((item) => {
              const pct = item.total_episodes > 0 ? Math.min(100, Math.round((item.episodes_watched / item.total_episodes) * 100)) : 0;
              const canMark = offersNextCheck(item, isOwner);
              return (
                <li key={item.show_id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
                  <Link href={titlePath("tv", item.show_id, item.show_name)} className="flex min-w-0 flex-1 items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getPosterUrl(item.poster_path, "w92")} alt="" loading="lazy" className="aspect-2/3 w-12 shrink-0 rounded-media object-cover ring-1 ring-inset ring-line" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-base text-ink-0">{item.show_name}</span>
                      <span className="block truncate text-sm text-ink-400">{seriesLine(item)}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1 w-24 overflow-hidden rounded-full bg-line-strong">
                          <span className="block h-full bg-action" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="font-mono text-xs tabular-nums text-ink-500">
                          {item.episodes_watched} of {item.total_episodes}
                        </span>
                      </span>
                    </span>
                  </Link>
                  {canMark && (
                    <button
                      type="button"
                      onClick={() => void markNext(item)}
                      disabled={marking === item.show_id}
                      aria-label={`Mark ${episodeLabel({ s: item.next_season!, e: item.next_episode! })} of ${item.show_name} watched`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-300 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 disabled:opacity-60"
                    >
                      {marking === item.show_id ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {size * PAGE_SIZE < total && (
            <button
              type="button"
              onClick={() => void setSize(size + 1)}
              disabled={loadingMore}
              className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0 disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : `Showing ${items.length} · More`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
