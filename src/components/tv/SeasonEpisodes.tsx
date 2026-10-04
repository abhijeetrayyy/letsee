"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { usePathname } from "next/navigation";
import { CheckCheck, Search } from "lucide-react";
import Link from "@components/ui/AppLink";
import EpisodeRow, { type EpisodeRowData } from "@components/ds/EpisodeRow";
import Progress, { type ProgressCell } from "@components/ds/Progress";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { useToday } from "@/hooks/useToday";
import { fetchRoomList, type RoomPerson } from "@/lib/db/rooms";
import { peopleOnEpisodes } from "@/lib/db/episodes";
import { epKey, isOut, type Ep, type SeasonInfo } from "@/lib/logging/episodes";
import { useEpisodeMarks } from "./useEpisodeMarks";
import { humanHours, seasonTime } from "@/utils/title/glance";

/**
 * A season's episodes (docs/design/PAGES.md, the season page): how far you
 * are as dots with your people's faces where they've got to, then one
 * `EpisodeRow` per episode. Long seasons get a search; very long ones arrive
 * a page at a time.
 */
const FIRST = 40;
const STEP = 40;

export default function SeasonEpisodes({
  showId,
  showName,
  season,
  episodes,
  seasons,
  lastAired,
}: {
  showId: string;
  showName: string;
  season: number;
  episodes: (EpisodeRowData & { id: number })[];
  seasons: SeasonInfo[];
  lastAired: Ep | null;
}) {
  const { user, ready } = useAuth();
  const me = user?.id ?? null;
  const pathname = usePathname();
  const marks = useEpisodeMarks(showId, { seasons, lastAired, enabled: !!me });
  const today = useToday();
  const [query, setQuery] = useState("");
  const [unwatchedOnly, setUnwatchedOnly] = useState(false);
  const [shown, setShown] = useState(FIRST);

  const { data: rooms } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const yourPeople = useMemo<RoomPerson[]>(() => (rooms?.people ?? []).slice(0, 24).map((p) => p.person), [rooms]);
  const { data: theirs } = useSWR(yourPeople.length ? ["episode-people", showId, season, yourPeople.map((p) => p.id).join(",")] : null, () => peopleOnEpisodes(yourPeople, showId, season), {
    revalidateOnFocus: false,
  });

  // Out: dated today or earlier, or undated but no later than the last aired.
  const notOut = (e: { episode_number: number; air_date?: string | null }) => (today ? !isOut({ s: season, e: e.episode_number }, e.air_date, lastAired, today) : false);
  const ordered = useMemo(() => [...episodes].sort((a, b) => a.episode_number - b.episode_number), [episodes]);
  const out = ordered.filter((e) => !notOut(e));
  const seen = out.filter((e) => marks.isWatched(season, e.episode_number)).length;

  // Each person's furthest episode this season, for their face above the dots.
  const reached = useMemo(() => {
    const furthest = new Map<string, { n: number; p: RoomPerson }>();
    for (const [k, list] of theirs ?? []) {
      const n = Number(k.split(":")[1]);
      for (const p of list) if ((furthest.get(p.id)?.n ?? 0) < n) furthest.set(p.id, { n, p });
    }
    const out = new Map<number, { username: string; avatarUrl: string | null }[]>();
    for (const { n, p } of furthest.values()) out.set(n, [...(out.get(n) ?? []), { username: p.username, avatarUrl: p.avatarUrl }]);
    return out;
  }, [theirs]);

  const finishedBy = useMemo(() => {
    if (!out.length) return [];
    const last = out[out.length - 1].episode_number;
    return [...reached.entries()].filter(([n]) => n >= last).flatMap(([, ps]) => ps.map((p) => p.username));
  }, [reached, out]);

  const cells: ProgressCell[] = ordered.map((e) => ({
    n: e.episode_number,
    state: notOut(e) ? "notout" : marks.isWatched(season, e.episode_number) ? "seen" : "open",
  }));

  const q = query.trim().toLowerCase();
  const filtered = ordered.filter((e) => {
    if (unwatchedOnly && marks.isWatched(season, e.episode_number)) return false;
    if (!q) return true;
    return e.name?.toLowerCase().includes(q) || String(e.episode_number) === q || `e${e.episode_number}` === q;
  });
  const visible = filtered.slice(0, shown);

  if (!episodes.length) {
    return <p className="py-6 text-sm text-ink-500">TMDB lists no episodes for this season yet.</p>;
  }

  // How long it runs, or how long is left once you've started (utils/title/glance.ts).
  const time = seasonTime(out, (n) => !!me && marks.ready && marks.isWatched(season, n));
  const summary = [
    me && marks.ready ? `${seen} of ${out.length} watched` : `${out.length} ${out.length === 1 ? "episode" : "episodes"} out`,
    time ? (seen > 0 && time.left > 0 ? `about ${humanHours(time.left)} to go` : seen > 0 ? null : humanHours(time.total)) : null,
    finishedBy.length ? `${finishedBy.slice(0, 2).join(" and ")}${finishedBy.length > 2 ? ` and ${finishedBy.length - 2} more` : ""} finished it` : null,
  ].filter(Boolean).join(" · ");

  return (
    <section aria-label="Episodes" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-300">{summary}</p>
          {me && marks.ready && seen < out.length && (
            <button
              type="button"
              onClick={() => marks.markAll(out.map((e) => ({ s: season, e: e.episode_number })))}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
            >
              <CheckCheck className="size-4" aria-hidden />
              Mark the season
            </button>
          )}
          {ready && !me && (
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="text-sm font-medium text-ink-0 underline decoration-line-input underline-offset-4">
              Sign in to keep track
            </Link>
          )}
        </div>
        {me && <Progress cells={cells} reached={reached} label={`${seen} of ${out.length} episodes watched`} />}
      </div>

      {ordered.length > 15 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Find an episode</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(FIRST);
              }}
              placeholder={`Find one of ${ordered.length} by name or number`}
              className="h-10 w-full rounded-control bg-raised pl-9 pr-3 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus:ring-focus"
            />
          </label>
          {me && (
            <button
              type="button"
              onClick={() => setUnwatchedOnly((v) => !v)}
              aria-pressed={unwatchedOnly}
              className={`inline-flex h-10 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${
                unwatchedOnly ? "bg-action text-on-action" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
              }`}
            >
              Not yet watched
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-4 text-sm text-ink-500">{unwatchedOnly && !q ? "You've watched every episode out so far." : "No episode matches that."}</p>
      ) : (
        <ol className="flex flex-col">
          {visible.map((e) => (
            <EpisodeRow
              key={e.id}
              showId={showId}
              showName={showName}
              season={season}
              ep={e}
              signedIn={!!me}
              watched={marks.isWatched(season, e.episode_number)}
              busy={epKey(season, e.episode_number) in marks.pending}
              notOut={notOut(e)}
              people={(theirs?.get(epKey(season, e.episode_number)) ?? []).map((p) => ({ username: p.username, avatarUrl: p.avatarUrl }))}
              onToggle={() => void marks.toggle({ s: season, e: e.episode_number })}
            />
          ))}
        </ol>
      )}

      {filtered.length > visible.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + STEP)}
          className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
        >
          Showing {visible.length} of {filtered.length} · More
        </button>
      )}
    </section>
  );
}
