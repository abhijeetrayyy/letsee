"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import Link from "@components/ui/AppLink";
import Sheet from "@components/ds/Sheet";
import { MarkIcons } from "@components/ds/MarkTiles";
import { useTitleSearch } from "@components/ds/TitlePicker";
import { EpisodeRow, SaveRow, episodesFetcher, type Episode } from "@components/ds/UpNextRows";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchSaves } from "@/lib/db/upNext";
import { laneOf } from "@/lib/people/lanes";
import { todayIso } from "@/utils/viewings";
import { getPosterUrl } from "@/utils/imageUrl";

/**
 * Log it from the bars (docs/design/PAGES.md §7, "Log it"): search first.
 *
 * Before you type, what you're most likely to have just watched — the next
 * episode of each show you're on, then what you lined up — each one tap from
 * the diary. Type, and every match logs with one tap, for today, with Undo and
 * *Add details* in the toast like everywhere else. Catching up on a lot at
 * once is still Quick add, a link at the foot.
 *
 * The rows are Up next's own (`UpNextRows`) on the same SWR keys, so a show
 * ticked here has moved on there too. Nothing loads until the sheet opens: the
 * body, and with it the search index and both reads, mounts only while open.
 */
export default function LogItSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add what you've watched" description="Search a film or series, then mark it: ✓ watched, ◷ watch later, ♥ favourite.">
      <Body onClose={onClose} />
    </Sheet>
  );
}

const key = (t: { itemType: string; itemId: string }) => `${t.itemType}:${t.itemId}`;

function Body({ onClose }: { onClose: () => void }) {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const region = (user?.watch_region || "US").toUpperCase();
  const [query, setQuery] = useState("");
  const { q, results, asking } = useTitleSearch(query);
  const input = useRef<HTMLInputElement>(null);

  const { data: saves, error: savesError, mutate: refreshSaves } = useSWR(me ? ["saves", me, region] : null, () => fetchSaves(me!, region), { revalidateOnFocus: false });
  const { data: episodes, error: episodesError, mutate: setEpisodes } = useSWR<{ items: Episode[] }>(me ? "/api/continue-watching" : null, episodesFetcher, {
    revalidateOnFocus: false,
  });

  /** Logged from here: shown as done while the sheet is open. */
  const [done, setDone] = useState<Set<string>>(new Set());
  const mark = (k: string, on: boolean) =>
    setDone((cur) => {
      const next = new Set(cur);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  // Logged from here: when the sheet closes, Up next (same SWR key) refetches,
  // so a row logged here can't be logged again there. Not before — the row
  // has to stay while its toast can still offer Add details and Undo.
  const loggedAny = useRef(false);
  useEffect(() => {
    loggedAny.current = done.size > 0;
  }, [done]);
  useEffect(
    () => () => {
      if (loggedAny.current) void refreshSaves();
    },
    [refreshSaves],
  );

  // The sheet focuses its own panel once its children have mounted, so the
  // field takes focus back a moment later — typing is the point of this sheet.
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const today = todayIso();
  const lane = { tonight: 0, "lined-up": 1, someday: 2 } as const;
  const lined = (saves ?? [])
    .map((s) => ({ s, rank: lane[laneOf(s, today)] }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5)
    .map((x) => x.s);
  const shows = (episodes?.items ?? []).filter((e) => e.can_mark_next && !e.is_caught_up && e.up_next.length > 0).slice(0, 4);
  const failed = !!me && ((!saves && !!savesError) || (!episodes && !!episodesError));
  const loading = !!me && !failed && (!saves || !episodes);

  return (
    <div className="grid gap-5">
      <label className="relative block">
        <span className="sr-only">A film or series</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="A film or series"
          autoComplete="off"
          className="h-12 w-full rounded-control bg-raised pl-10 pr-10 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        {asking && <LoaderCircle className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-500" aria-hidden />}
      </label>

      {q ? (
        <ul className="-mt-1 divide-y divide-line" aria-label="Matches">
          {results.map((t) => (
            <li key={key(t)} className="flex items-center gap-3.5 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getPosterUrl(t.imageUrl, "w92")} alt="" decoding="async" className="aspect-2/3 w-10 shrink-0 rounded-media bg-hover object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base text-ink-0">{t.itemName}</span>
                <span className="block text-xs text-ink-500">{[t.year, t.itemType === "tv" ? "Series" : "Film"].filter(Boolean).join(" · ")}</span>
              </span>
              {/* The marks, right in the row: one title after another, nothing opened. */}
              <MarkIcons title={{ itemId: t.itemId, itemType: t.itemType, itemName: t.itemName, imageUrl: t.imageUrl }} />
            </li>
          ))}
          {results.length === 0 && q.length >= 2 && <li className="py-3 text-sm text-ink-500">{asking ? "Looking…" : "Nothing by that name."}</li>}
        </ul>
      ) : failed ? (
        <p className="text-sm text-ink-500">What you&apos;re watching didn&apos;t load. Search for the title instead.</p>
      ) : loading ? (
        <div className="grid gap-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-card bg-raised" />
          ))}
        </div>
      ) : (
        <>
          {shows.length > 0 && (
            <section aria-labelledby="log-next-episodes">
              <h3 id="log-next-episodes" className="font-mono text-xs uppercase tracking-wide text-ink-500">
                Next episodes
              </h3>
              <ul className="mt-1 divide-y divide-line">
                {shows.map((e) => (
                  <EpisodeRow
                    key={e.show_id}
                    episode={e}
                    all={episodes!.items}
                    onMarked={(next) => void setEpisodes(next, { revalidate: false })}
                    onFailed={() => void setEpisodes()}
                    onSaved={() => void setEpisodes()}
                  />
                ))}
              </ul>
            </section>
          )}
          {lined.length > 0 && (
            <section aria-labelledby="log-lined-up">
              <h3 id="log-lined-up" className="font-mono text-xs uppercase tracking-wide text-ink-500">
                Lined up
              </h3>
              <ul className="mt-1 divide-y divide-line">
                {lined.map((s) => (
                  <SaveRow key={key(s)} save={s} done={done.has(key(s))} onDone={(on) => mark(key(s), on)} />
                ))}
              </ul>
            </section>
          )}
          {!shows.length && !lined.length && (
            <p className="text-sm leading-relaxed text-ink-500">
              Type the name of anything you&apos;ve watched, want to watch, or love — and tap its mark. To add it to your diary with a date and stars, open it.
            </p>
          )}
        </>
      )}

      <Link
        href="/app/quick-add"
        onClick={onClose}
        className="flex items-center justify-between gap-3 rounded-card px-1 py-1 text-sm text-ink-400 transition-colors hover:text-ink-0"
      >
        Marking lots at once? Use fast mode — tap posters to mark them
        <ArrowRight className="size-4 shrink-0" aria-hidden />
      </Link>
    </div>
  );
}
