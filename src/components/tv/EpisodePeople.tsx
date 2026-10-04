"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import Faces from "@components/ds/Faces";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList, type RoomPerson } from "@/lib/db/rooms";
import { peopleOnEpisodes } from "@/lib/db/episodes";
import { epKey } from "@/lib/logging/episodes";
import { profilePath } from "@/utils/urls";

/**
 * "Who's watched it" on an episode page (docs/design/PAGES.md): faces and
 * names of your people who've marked this episode, and nothing at all when
 * none have. Same query and cache key as the season list's faces.
 */
export default function EpisodePeople({ showId, seasonNumber, episodeNumber }: { showId: string; seasonNumber: number; episodeNumber: number }) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const { data: rooms } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const yourPeople = useMemo<RoomPerson[]>(() => (rooms?.people ?? []).slice(0, 24).map((p) => p.person), [rooms]);
  const { data } = useSWR(yourPeople.length ? ["episode-people", showId, seasonNumber, yourPeople.map((p) => p.id).join(",")] : null, () => peopleOnEpisodes(yourPeople, showId, seasonNumber), {
    revalidateOnFocus: false,
  });
  const people = data?.get(epKey(seasonNumber, episodeNumber)) ?? [];
  if (!people.length) return null;

  return (
    <p className="flex items-center gap-3 text-sm text-ink-300">
      <Faces people={people} size={24} />
      <span className="min-w-0">
        {people.slice(0, 3).map((p, i) => (
          <span key={p.id}>
            {i > 0 && (i === people.slice(0, 3).length - 1 && people.length <= 3 ? " and " : ", ")}
            <Link href={profilePath(p.username)} className="font-medium text-ink-0 hover:underline hover:underline-offset-4">
              {p.username}
            </Link>
          </span>
        ))}
        {people.length > 3 && ` and ${people.length - 3} more`} watched it
      </span>
    </p>
  );
}
