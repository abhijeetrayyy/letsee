"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Tv } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Sheet from "@components/ds/Sheet";
import TitlePicker from "@components/ds/TitlePicker";
import { supabase } from "@/utils/supabase/client";
import { swrFetcher } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { episodeLabel } from "@/lib/logging/episodes";
import { whosWhere } from "@/lib/people/seriesRoom";
import type { ShowNext } from "@/app/api/show-next/route";

/**
 * A room for a series (docs/IDEAS_2026-10.md §6.1): a group watching one show
 * together — the buddy read, for television. Where everyone is (from each
 * member's own episodes, under their profile's visibility), and the next
 * episode you can all watch: the one after whoever's furthest behind. The
 * group's talk, below, can be about one episode and stays closed until each
 * of you gets there (social/Comments).
 *
 * Organisers set the series (migration 126, `clubs_update_admin`). One read
 * for everyone's episodes of it; the show's seasons from the edge-cached
 * `/api/show-next`.
 */
type Member = { userId: string; username: string; avatarUrl: string | null };
export type GroupSeries = { id: string; name: string; image: string | null };

export default function SeriesTogether({
  clubId,
  series,
  members,
  isAdmin,
  onChanged,
}: {
  clubId: number;
  series: GroupSeries | null;
  members: Member[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [picking, setPicking] = useState(false);

  const setSeries = async (next: GroupSeries | null) => {
    const { error } = await supabase
      .from("clubs")
      .update({ series_id: next?.id ?? null, series_name: next?.name ?? null, series_image: next?.image ?? null })
      .eq("id", clubId);
    if (error) {
      toast.error("That didn't save. Only the group's organisers can set its series.");
      return;
    }
    setPicking(false);
    toast.success(next ? `Watching ${next.name} together` : "No series for now");
    onChanged();
  };

  const picker = (
    <Sheet open={picking} onClose={() => setPicking(false)} title="The series you're watching together" description="Everyone's place in it shows here, and talk can be about one episode.">
      {picking && (
        <TitlePicker
          placeholder="A series"
          onPick={(t) => {
            if (t.itemType !== "tv") {
              toast("That's a film — pick a series to watch together.", { id: "series-room-film" });
              return;
            }
            void setSeries({ id: t.itemId, name: t.itemName, image: t.imageUrl });
          }}
        />
      )}
    </Sheet>
  );

  if (!series) {
    if (!isAdmin) return null;
    return (
      <section aria-labelledby="series-together" className="rounded-card border border-line-strong bg-raised p-5">
        <h2 id="series-together" className="flex items-center gap-2 text-xl text-ink-0">
          <Tv className="size-5 text-accent" aria-hidden />
          Watching a series together?
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-400">Set it, and see where everyone is — and the next episode you can all watch. Talk about an episode stays closed until each of you gets there.</p>
        <button type="button" onClick={() => setPicking(true)} className="mt-4 inline-flex h-10 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
          Set the series
        </button>
        {picker}
      </section>
    );
  }

  return (
    <section aria-labelledby="series-together">
      <div className="mb-4 flex items-center gap-4">
        <Link href={titlePath("tv", series.id, series.name)} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getPosterUrl(series.image, "w185")} alt="" className="aspect-2/3 w-14 rounded-media bg-hover object-cover ring-1 ring-inset ring-line-strong" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">Watching together</p>
          <h2 id="series-together" className="truncate text-2xl text-ink-0 sm:text-3xl">
            <Link href={titlePath("tv", series.id, series.name)} className="hover:underline">
              {series.name}
            </Link>
          </h2>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setPicking(true)} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-400 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
            Change
          </button>
        )}
      </div>
      <Seats showId={series.id} members={members} />
      {picker}
    </section>
  );
}

function Seats({ showId, members }: { showId: string; members: Member[] }) {
  const ids = members.map((m) => m.userId);
  const { data: show } = useSWR<ShowNext>(`/api/show-next?id=${showId}`, swrFetcher, { revalidateOnFocus: false });
  const { data: rows } = useSWR(ids.length ? ["series-room-episodes", showId, ids.join(",")] : null, async () => {
    const { data } = await supabase.from("watched_episodes").select("user_id, season_number, episode_number").eq("show_id", showId).in("user_id", ids).gt("season_number", 0).limit(20000);
    return data ?? [];
  }, { revalidateOnFocus: false });
  if (!show || !rows) return <div className="h-24 rounded-card bg-raised" aria-hidden />;

  const byUser = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byUser.get(r.user_id as string) ?? new Set<string>();
    set.add(`${r.season_number}:${r.episode_number}`);
    byUser.set(r.user_id as string, set);
  }
  const { seats, aired, together, started } = whosWhere(
    members.map((m) => ({ person: m, watched: byUser.get(m.userId) ?? new Set<string>() })),
    show.seasons,
    show.lastAired,
  );

  return (
    <div className="grid gap-3">
      <p className="text-sm text-ink-300" aria-live="polite">
        {together ? (
          <>
            Next you can all watch: <span className="font-mono text-ink-0">{episodeLabel(together)}</span>
            {started < seats.length && <span className="text-ink-500"> · {seats.length - started} not started yet</span>}
          </>
        ) : (
          "You're all caught up with what's aired."
        )}
      </p>
      <ul className="grid gap-2.5">
        {seats.map(({ person, at, seen }) => (
          <li key={person.userId} className="flex items-center gap-3">
            <Link href={`/app/profile/${encodeURIComponent(person.username)}`} className="shrink-0">
              <Avatar src={person.avatarUrl} name={person.username} size={28} />
            </Link>
            <span className="w-24 shrink-0 truncate text-sm text-ink-0 sm:w-32">{person.username}</span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hover" aria-hidden>
              <span className="block h-full rounded-full bg-action" style={{ width: `${aired ? Math.round((seen / aired) * 100) : 0}%` }} />
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-xs uppercase tracking-wide text-ink-400">{at ? episodeLabel(at) : "Not started"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
