"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import { FollowerBtnClient } from "@components/profile/profileBtn";
import { fetchMyNeighbours } from "@/lib/db/taste";
import { fetchRoomList } from "@/lib/db/rooms";
import { recentlyActive, visibilityOf } from "@/lib/db/search";
import { ago } from "@components/rooms/time";

/**
 * People you could watch with (People and Home's rail): the nightly taste
 * neighbours first, introduced by films you've both seen, then people who
 * logged something lately, with what it was. Follow respects private profiles
 * (it sends a request). Nothing here is ranked by counts.
 *
 * Never someone you already have: your rooms and everyone you follow are left
 * out here, on the client, because both lists below are cached before the
 * rooms have loaded — that is how a person you'd been messaging turned up
 * under "You might get along with" with a Follow button.
 */
export default function Discover({ me, known, className = "mt-10" }: { me: string; known: Set<string>; className?: string }) {
  const { data: list } = useSWR(["rooms", me], () => fetchRoomList(me), { revalidateOnFocus: false });
  const have = new Set([...known, ...(list?.following ?? []), ...(list?.rooms ?? []).map((r) => r.person.id)]);
  const { data: matches } = useSWR(["taste-neighbours", me], () => fetchMyNeighbours(12), { revalidateOnFocus: false });
  const fresh = (matches ?? []).filter((m) => !have.has(m.userId)).slice(0, 6);
  const { data: active } = useSWR(matches && fresh.length < 3 ? ["recently-active", me] : null, () => recentlyActive(me, new Set(), 12), { revalidateOnFocus: false });
  const others = (active ?? []).filter((p) => !have.has(p.id) && !fresh.some((f) => f.userId === p.id)).slice(0, 6 - fresh.length);
  const shownIds = [...fresh.map((m) => m.userId), ...others.map((p) => p.id)];
  const { data: visibility } = useSWR(shownIds.length ? ["visibility", shownIds.join(",")] : null, () => visibilityOf(shownIds), { revalidateOnFocus: false });
  // Wait for the rooms too, or someone you already have flashes up and vanishes.
  if (!matches || !list || (!fresh.length && !others.length)) return null;

  return (
    <section aria-labelledby="discover" className={className}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id="discover" className="text-xl text-ink-0">
          {fresh.length ? "You might get along with" : "People to watch with"}
        </h2>
        <Link href="/app/search?scope=people" className="text-xs text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0">
          Find anyone
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {fresh.map((m) => {
          const shared = m.sharedTitles.slice(0, 2).map((t) => t.name);
          const more = m.sharedCount - shared.length;
          return (
            <li key={m.userId} className="flex items-center gap-3 py-3">
              <Link href={`/app/profile/${encodeURIComponent(m.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={m.avatarUrl} name={m.username} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium text-ink-0">{m.username}</span>
                  {shared.length > 0 && (
                    <span className="block truncate text-sm text-ink-400">
                      You’ve both seen <span className="font-display text-ink-200">{shared.join(", ")}</span>
                      {more > 0 ? ` and ${more} more` : ""}
                    </span>
                  )}
                </span>
              </Link>
              <FollowerBtnClient profileId={m.userId} currentUserId={me} initialStatus="follow" profileVisibility={visibility?.get(m.userId) ?? "private"} />
            </li>
          );
        })}
        {others.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3">
            <Link href={`/app/profile/${encodeURIComponent(p.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar src={p.avatarUrl} name={p.username} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-base font-medium text-ink-0">{p.username}</span>
                <span className="block truncate text-sm text-ink-400">
                  {p.lastTitle ? (
                    <>
                      Watched <span className="font-display text-ink-200">{p.lastTitle}</span> · {ago(p.lastAt)}
                    </>
                  ) : (
                    <>Logged something · {ago(p.lastAt)}</>
                  )}
                </span>
              </span>
            </Link>
            <FollowerBtnClient profileId={p.id} currentUserId={me} initialStatus="follow" profileVisibility={visibility?.get(p.id) ?? "private"} />
          </li>
        ))}
      </ul>
    </section>
  );
}

