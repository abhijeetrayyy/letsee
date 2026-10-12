"use client";

import useSWR from "swr";
import { Home } from "lucide-react";
import Link from "@components/ui/AppLink";
import { fetchHousehold, fetchTheirEpisodes } from "@/lib/db/households";
import { positionOf, type Ep, type SeasonInfo } from "@/lib/logging/episodes";
import { householdLine } from "@/lib/people/household";
import type { RoomPerson } from "@/lib/db/rooms";

/**
 * On a series, where the people you live with are (migration 124): one line
 * each under "Where are you?". Nothing for anyone who hasn't said who they
 * live with. Their episodes read under their profile's visibility.
 */
export default function HouseholdPositions({ me, showId, seasons, lastAired, mine }: { me: string; showId: string; seasons: SeasonInfo[]; lastAired: Ep | null; mine: Ep | null }) {
  const { data: household } = useSWR(["household", me], () => fetchHousehold(me), { revalidateOnFocus: false });
  if (!household?.length) return null;
  return (
    <ul className="grid gap-1">
      {household.map((h) => (
        <Line key={h.id} person={h} showId={showId} seasons={seasons} lastAired={lastAired} mine={mine} />
      ))}
    </ul>
  );
}

function Line({ person, showId, seasons, lastAired, mine }: { person: RoomPerson; showId: string; seasons: SeasonInfo[]; lastAired: Ep | null; mine: Ep | null }) {
  const { data: theirs } = useSWR(["their-episodes", person.id, showId], () => fetchTheirEpisodes(person.id, showId), { revalidateOnFocus: false });
  if (!theirs) return null;
  const line = householdLine(person.username, positionOf(seasons, theirs, lastAired), mine, seasons, lastAired);
  return (
    <li className="flex items-center gap-2 text-sm text-ink-400">
      <Home className="size-3.5 shrink-0 text-ink-500" aria-hidden />
      <Link href={`/app/people/${encodeURIComponent(person.username)}`} className="hover:text-ink-0 hover:underline">
        {line}
      </Link>
    </li>
  );
}
