"use client";

import { useContext } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import TitleCard from "@components/ds/TitleCard";
import Rail from "@components/ds/Rail";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { useInView } from "@/hooks/useInView";
import { swrFetcher } from "@/utils/swrFetcher";
import { personPath } from "@/utils/urls";
import type { PersonWorkResponse, WorkItem } from "@/app/api/person-work/route";

const FACE = "https://image.tmdb.org/t/p/w185";

/**
 * "More from Christopher Nolan" — and how many of them you've seen.
 *
 * A title's director (a series' creator), or its lead, with their other work
 * in a row of posters you can mark from where they are. For a director or a
 * creator, a line that turns a filmography into something to finish: "You've
 * seen 6 of 12", with a bar — and, when it's all of them, a word for it. The
 * count is read from your own marks in memory, so it costs nothing.
 *
 * Asks for nothing until it's a screen away (useInView), and then one cached
 * request per person that every one of their titles shares (api/person-work).
 */
export default function MoreFrom({
  person,
  role,
  current,
}: {
  person: { id: number; name: string; profilePath?: string | null };
  role: "director" | "creator" | "actor";
  current: { id: number | string; type: "movie" | "tv" };
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const { status } = useAuth();
  const { getStatus } = useContext(UserPrefrenceContext);
  const { data } = useSWR<PersonWorkResponse>(inView ? `/api/person-work?id=${person.id}` : null, swrFetcher, { revalidateOnFocus: false });

  const list: WorkItem[] = data ? (role === "director" ? data.directed : role === "creator" ? data.created : data.acted) : [];
  const isCurrent = (i: WorkItem) => i.type === current.type && String(i.id) === String(current.id);
  const others = list.filter((i) => !isCurrent(i));
  const released = list.filter((i) => !i.upcoming);
  const seen = released.filter((i) => getStatus(String(i.id), i.type) === "watched").length;
  const counted = role !== "actor" && status === "ok" && released.length >= 3;
  const every = counted && seen === released.length;
  const face = person.profilePath ?? data?.person.profilePath ?? null;
  const kind = role === "creator" ? "series" : role === "director" ? "films" : null;

  // Until it's near, a placeholder the observer can see; with nothing more by them, nothing at all.
  if (!data) return <section ref={ref} aria-hidden className="min-h-px" />;
  if (others.length === 0) return null;

  return (
    <section ref={ref} aria-labelledby={`more-${role}-${person.id}`}>
      <div className="mb-4 flex items-center gap-4">
        <Link href={personPath(person.id, person.name)} className="shrink-0" aria-hidden tabIndex={-1}>
          {face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${FACE}${face}`} alt="" loading="lazy" className="size-14 rounded-full bg-hover object-cover ring-2 ring-accent/60 sm:size-16" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-active text-lg font-medium text-ink-200 sm:size-16">{person.name.charAt(0)}</span>
          )}
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
            {role === "director" ? "More from the director" : role === "creator" ? "More from its creator" : "More with"}
          </p>
          <h2 id={`more-${role}-${person.id}`} className="truncate text-2xl text-ink-0">
            <Link href={personPath(person.id, person.name)} className="hover:underline">
              {person.name}
            </Link>
          </h2>
        </div>
      </div>

      {counted && (
        <div className="mb-5 max-w-read">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-300">
              You&apos;ve seen <span className="font-mono tabular-nums text-ink-0">{seen}</span> of {released.length} {kind}
            </span>
            <span className={every ? "font-medium text-accent" : "text-ink-500"}>
              {every ? "Every one of them" : seen === 0 ? "Start anywhere" : `${released.length - seen} to go`}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-active" role="progressbar" aria-valuemin={0} aria-valuemax={released.length} aria-valuenow={seen} aria-label={`${seen} of ${released.length} seen`}>
            <div className="h-full rounded-full bg-action transition-all duration-500" style={{ width: `${Math.round((seen / released.length) * 100)}%` }} />
          </div>
        </div>
      )}

      <Rail>
        <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8">
          {others.map((i) => (
            <li key={`${i.type}:${i.id}`} className="w-32 shrink-0 snap-start sm:w-36">
              <TitleCard id={i.id} title={i.title} mediaType={i.type} posterPath={i.posterPath} year={i.upcoming ? (i.year ? `Out ${i.year}` : "Coming") : i.year} />
            </li>
          ))}
        </ul>
      </Rail>
    </section>
  );
}
