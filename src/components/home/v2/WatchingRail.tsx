"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import Rail from "@components/ds/Rail";
import { supabase } from "@/utils/supabase/client";
import { swrFetcher } from "@/utils/swrFetcher";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { todayIso } from "@/utils/viewings";
import { whereLabel } from "@/lib/logging/episodes";
import type { WatchingItem } from "@/lib/db/home";
import type { ShowNext } from "@/app/api/show-next/route";
import { SectionTitle } from "./parts";

/**
 * What are you on? (docs/IDEAS_2026-10.md §7.2) — the first of Home's three
 * questions: what you're watching, each show with where you are in it ("S02 ·
 * E05 next", or when it's back).
 *
 * No server round trip of its own: your episodes of these shows are one read
 * under RLS, and each show's seasons come from `/api/show-next`, cached at the
 * edge for everyone (the same entry Up next's on-hold rows and a series room
 * use).
 */
export default function WatchingRail({ me, items }: { me: string; items: WatchingItem[] }) {
  const shows = items.filter((w) => w.item_type === "tv").map((w) => String(w.item_id));
  const { data: watched } = useSWR(
    shows.length ? ["rail-episodes", me, shows.join(",")] : null,
    async () => {
      const { data, error } = await supabase.from("watched_episodes").select("show_id, season_number, episode_number").eq("user_id", me).in("show_id", shows).gt("season_number", 0).limit(20000);
      // Unknown isn't "nothing watched": say nothing rather than "S01 · E01 next".
      if (error) throw error;
      const byShow = new Map<string, Set<string>>();
      for (const r of data ?? []) {
        const set = byShow.get(String(r.show_id)) ?? new Set<string>();
        set.add(`${r.season_number}:${r.episode_number}`);
        byShow.set(String(r.show_id), set);
      }
      return byShow;
    },
    { revalidateOnFocus: false },
  );

  return (
    <section aria-labelledby="watching">
      <SectionTitle
        more={
          <Link href="/app/up-next" className="text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0">
            Up next
          </Link>
        }
      >
        <span id="watching">What you’re watching</span>
      </SectionTitle>
      <Rail>
        <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 sm:scroll-px-6 lg:scroll-px-8 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {items.map((w) => (
            <li key={`${w.item_type}:${w.item_id}`} className="w-36 shrink-0 snap-start sm:w-44">
              <Link href={titlePath(w.item_type === "tv" ? "tv" : "movie", w.item_id, w.item_name)} className="group block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getPosterUrl(w.image_url, "w342")} alt="" loading="lazy" className="img-fade aspect-2/3 w-full rounded-media bg-raised object-cover ring-1 ring-inset ring-line transition-opacity group-hover:opacity-90" />
                <span className="mt-2 block truncate font-display text-base text-ink-0">{w.item_name}</span>
                {w.item_type === "tv" && <Where showId={String(w.item_id)} watched={watched?.get(String(w.item_id)) ?? (watched ? new Set<string>() : undefined)} />}
              </Link>
            </li>
          ))}
        </ul>
      </Rail>
    </section>
  );
}

/** One show's place. The line is held while it loads, so the rail doesn't jump. */
function Where({ showId, watched }: { showId: string; watched: Set<string> | undefined }) {
  const { data: show } = useSWR<ShowNext>(`/api/show-next?id=${showId}`, swrFetcher, { revalidateOnFocus: false });
  const label = show && watched ? whereLabel(show, watched, todayIso()) : null;
  return <span className="mt-0.5 block h-4 truncate font-mono text-xs uppercase tracking-wide text-ink-500">{label}</span>;
}
