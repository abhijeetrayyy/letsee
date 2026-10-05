"use client";

import { useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { Clapperboard, Heart, ListVideo, Play, Sparkles, Star } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import PeopleNav from "@components/rooms/PeopleNav";
import FollowButton from "@components/profile/FollowButton";
import { QuickMarkButton } from "@components/ds/QuickMarks";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchActivity, intoRuns, type ActivityEvent, type ActivityKind, type ActivityRun, type ActivityScope } from "@/lib/db/activity";
import { ago, dayLabel } from "@components/rooms/time";
import { listPath, profilePath, titlePath } from "@/utils/urls";

/**
 * Activity: what everyone on letsee is watching, loving, rating, writing and
 * making — or just the people you follow — newest first, by day.
 *
 * Every poster in it can be marked where it is (ds/QuickMarks): seeing what
 * someone watched is the moment you remember you've seen it too, or want to.
 * A burst (fifty films marked in a sitting) is one line with its posters, not
 * fifty. Read in the browser under RLS (lib/db/activity); "Load more" goes
 * further back in time, so nothing repeats.
 */
type Filter = "all" | "watched" | "loved" | "words" | "lists" | "people";

const FILTERS: { key: Filter; label: string; kinds: ActivityKind[] }[] = [
  { key: "all", label: "Everything", kinds: ["watched", "watching", "rated", "reviewed", "loved", "list", "joined"] },
  { key: "watched", label: "Watched", kinds: ["watched", "watching"] },
  { key: "loved", label: "Loved", kinds: ["loved"] },
  { key: "words", label: "Ratings & reviews", kinds: ["rated", "reviewed"] },
  { key: "lists", label: "Lists", kinds: ["list"] },
  { key: "people", label: "New people", kinds: ["joined"] },
];

export default function ActivityClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const [scope, setScope] = useState<ActivityScope>("everyone");
  const [filter, setFilter] = useState<Filter>("all");

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite(
    (index, previous: { next: string | null } | null) => {
      if (status === "loading") return null;
      if (index > 0 && !previous?.next) return null;
      return ["activity", scope, me, index === 0 ? null : previous!.next];
    },
    ([, s, who, before]) => fetchActivity({ me: who as string | null, scope: s as ActivityScope, before: before as string | null }),
    { revalidateOnFocus: false, revalidateFirstPage: false },
  );

  const kinds = FILTERS.find((f) => f.key === filter)!.kinds;
  const events = useMemo(() => (data ?? []).flatMap((p) => p.events).filter((e) => kinds.includes(e.kind)), [data, kinds]);
  const days = useMemo(() => {
    const out: { label: string; runs: ActivityRun[] }[] = [];
    for (const run of intoRuns(events)) {
      const label = dayLabel(run.at);
      if (out.at(-1)?.label === label) out.at(-1)!.runs.push(run);
      else out.push({ label, runs: [run] });
    }
    return out;
  }, [events]);
  const more = !!data?.at(-1)?.next;
  const loadingMore = isValidating && size > (data?.length ?? 0);

  const chip = (on: boolean) =>
    `inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${on ? "bg-ink-0 text-page" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`;

  return (
    <div className="mx-auto w-full max-w-app px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <h1 className="mb-5 text-4xl text-ink-0 sm:text-5xl">People</h1>
      <PeopleNav current="activity" />

      <div className="max-w-read">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base text-ink-400">What people on letsee are watching, loving and making — mark anything you see.</p>
          {me && (
            <div className="flex rounded-full p-1 ring-1 ring-inset ring-line-input" role="group" aria-label="Whose activity">
              {(["everyone", "people"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={`h-8 rounded-full px-3 text-sm font-medium transition-colors ${scope === s ? "bg-action text-on-action" : "text-ink-300 hover:text-ink-0"}`}>
                  {s === "everyone" ? "Everyone" : "People you follow"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} className={chip(filter === f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && !data ? (
          <FeedSkeleton />
        ) : days.length === 0 ? (
          <div className="mt-10 rounded-card bg-raised p-6 ring-1 ring-inset ring-line-strong">
            <p className="text-base text-ink-0">{scope === "people" ? "Nothing yet from the people you follow." : "Nothing here yet."}</p>
            <p className="mt-1 text-sm text-ink-400">
              {scope === "people" ? (
                <>
                  Follow a few more people from{" "}
                  <Link href="/app/people/find" className="text-accent underline underline-offset-4">
                    Find people
                  </Link>
                  , or switch to Everyone.
                </>
              ) : (
                "As people mark and log what they watch, it shows up here."
              )}
            </p>
          </div>
        ) : (
          <div className="mt-8 flex flex-col gap-9">
            {days.map((d) => (
              <section key={d.label} aria-label={d.label}>
                <h2 className="sticky top-14 z-10 -mx-4 bg-page/95 px-4 py-2 font-sans text-xs font-medium uppercase tracking-wider text-ink-500 backdrop-blur md:top-14">{d.label}</h2>
                <ul className="divide-y divide-line">
                  {d.runs.map((run) => (
                    <RunRow key={run.key} run={run} me={me} />
                  ))}
                </ul>
              </section>
            ))}
            {more && (
              <button
                type="button"
                onClick={() => void setSize(size + 1)}
                disabled={loadingMore}
                className="mx-auto inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const VERB: Record<ActivityKind, (n: number) => string> = {
  watched: (n) => (n > 1 ? `watched ${n} titles` : "watched"),
  watching: (n) => (n > 1 ? `started ${n} titles` : "started watching"),
  rated: () => "rated",
  reviewed: () => "wrote about",
  loved: (n) => (n > 1 ? `loved ${n} titles` : "loved"),
  list: () => "made a list",
  joined: () => "joined letsee",
};

const ICON: Record<ActivityKind, typeof Heart> = {
  watched: Clapperboard,
  watching: Play,
  rated: Star,
  reviewed: Star,
  loved: Heart,
  list: ListVideo,
  joined: Sparkles,
};

function RunRow({ run, me }: { run: ActivityRun; me: string | null }) {
  const first = run.events[0];
  const Icon = ICON[run.kind];
  const many = run.events.length > 1;
  return (
    <li className="flex gap-3 py-4">
      <Link href={profilePath(run.person.username)} className="shrink-0">
        <Avatar src={run.person.avatarUrl} name={run.person.username} size={40} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-ink-300">
          <Link href={profilePath(run.person.username)} className="font-semibold text-ink-0 hover:underline">
            {run.person.username}
          </Link>{" "}
          <Icon className={`mx-0.5 inline size-3.5 -translate-y-px ${run.kind === "loved" ? "fill-accent text-accent" : "text-ink-500"}`} aria-hidden /> {VERB[run.kind](run.events.length)}
          {!many && first.title && (
            <>
              {" "}
              <Link href={titlePath(first.title.itemType, first.title.itemId, first.title.name)} className="font-display text-base text-ink-0 hover:underline">
                {first.title.name}
              </Link>
            </>
          )}
          {run.kind === "list" && first.list && (
            <>
              {" "}
              <Link href={listPath(first.list.id, first.list.name)} className="font-display text-base text-ink-0 hover:underline">
                {first.list.name}
              </Link>
            </>
          )}
          <span className="ml-1.5 text-xs text-ink-500">· {ago(run.at)}</span>
        </p>
        {!many && first.score != null && <Stars score={first.score} />}
        {!many && first.words && <p className="mt-1.5 line-clamp-3 border-l-2 border-line pl-3 text-sm italic text-ink-400">&ldquo;{first.words}&rdquo;</p>}
        {run.kind === "joined" && me && (
          <div className="mt-2">
            <FollowButton targetUserId={run.person.id} currentUserId={me} initialStatus="follow" size="sm" />
          </div>
        )}
        {many && <PosterStrip events={run.events} />}
      </div>
      {!many && first.title && <Poster event={first} />}
    </li>
  );
}

function Poster({ event }: { event: ActivityEvent }) {
  const t = event.title!;
  return (
    <div className="relative w-14 shrink-0">
      <Link href={titlePath(t.itemType, t.itemId, t.name)} aria-label={t.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={t.imageUrl ?? "/no-photo.svg"} alt="" loading="lazy" className="aspect-2/3 w-full rounded-media bg-hover object-cover ring-1 ring-inset ring-line-strong" />
      </Link>
      <QuickMarkButton title={{ itemId: t.itemId, itemType: t.itemType, itemName: t.name, imageUrl: t.imageUrl }} className="absolute -right-2 -top-2 size-7" />
    </div>
  );
}

function PosterStrip({ events }: { events: ActivityEvent[] }) {
  const shown = events.filter((e) => e.title).slice(0, 12);
  return (
    <ul className="no-scrollbar -mr-4 mt-3 flex gap-2 overflow-x-auto pb-1 pr-4">
      {shown.map((e) => (
        <li key={e.id} className="relative w-16 shrink-0 pt-2">
          <Link href={titlePath(e.title!.itemType, e.title!.itemId, e.title!.name)} aria-label={e.title!.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.title!.imageUrl ?? "/no-photo.svg"} alt="" loading="lazy" className="aspect-2/3 w-full rounded-media bg-hover object-cover ring-1 ring-inset ring-line-strong" />
          </Link>
          <QuickMarkButton title={{ itemId: e.title!.itemId, itemType: e.title!.itemType, itemName: e.title!.name, imageUrl: e.title!.imageUrl }} className="absolute -right-1.5 top-0 size-7" />
        </li>
      ))}
      {events.length > shown.length && (
        <li className="flex w-16 shrink-0 items-center justify-center text-sm text-ink-500">+{events.length - shown.length}</li>
      )}
    </ul>
  );
}

function Stars({ score }: { score: number }) {
  const stars = score / 2;
  return (
    <p className="mt-1 font-mono text-sm tracking-wider text-accent" aria-label={`${stars} out of 5`}>
      {"★".repeat(Math.floor(stars))}
      {stars % 1 >= 0.5 ? "½" : ""}
      <span className="text-ink-600">{"★".repeat(5 - Math.ceil(stars))}</span>
    </p>
  );
}

function FeedSkeleton() {
  return (
    <ul className="mt-8 divide-y divide-line" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex gap-3 py-4">
          <span className="size-10 shrink-0 animate-pulse rounded-full bg-active motion-reduce:animate-none" />
          <span className="flex-1 space-y-2 pt-1">
            <span className="block h-4 w-3/4 animate-pulse rounded bg-active motion-reduce:animate-none" />
            <span className="block h-3 w-1/3 animate-pulse rounded bg-active motion-reduce:animate-none" />
          </span>
          <span className="aspect-2/3 w-14 shrink-0 animate-pulse rounded-media bg-active motion-reduce:animate-none" />
        </li>
      ))}
    </ul>
  );
}
