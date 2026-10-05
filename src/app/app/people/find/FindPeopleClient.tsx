"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { MessageCircle, Search } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import FollowButton from "@components/profile/FollowButton";
import PeopleNav from "@components/rooms/PeopleNav";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList } from "@/lib/db/rooms";
import { fetchMyNeighbours } from "@/lib/db/taste";
import { recentlyActive, searchUsers, sharedLoves } from "@/lib/db/search";
import { detailsFor, followedByYourPeople, newOnLetsee, type Candidate, type Details } from "@/lib/db/discover";
import { inviteSomeone } from "@components/home/v2/parts";
import { ago } from "@components/rooms/time";

/**
 * Find people on letsee — not actors: Search's people are TMDB's cast and
 * crew, and "Find anyone" used to send you there.
 *
 * Typing searches members by username. Before that, shelves of people you
 * might want to know, each saying why in a few words: your taste (the nightly
 * neighbours, introduced by films you've both seen), the people you follow
 * (who they follow), who's new, and who's been watching lately. Every row
 * shows the four films on their profile, when it's public — what someone
 * loves says more than a name — and Follow and Message right there.
 *
 * Nobody you already follow, and nobody twice: each shelf skips everyone the
 * shelves above it showed.
 */
export default function FindPeopleClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const [query, setQuery] = useState("");

  // Arriving with a name (People's "Find more people"): start with it typed.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address is only read in the browser
    if (q) setQuery(q);
  }, []);

  const { data: rooms } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const following = useMemo(() => new Set(rooms?.following ?? []), [rooms]);

  if (status === "anon") {
    return (
      <Page>
        <p className="text-base text-ink-400">Sign in to find people on letsee: friends you watch with, and people whose taste is close to yours.</p>
        <Link href="/login?next=/app/people/find" className="mt-6 inline-flex h-11 items-center rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
          Sign in
        </Link>
      </Page>
    );
  }

  const q = query.trim().replace(/^@/, "");

  return (
    <Page>
      <label className="relative block max-w-read">
        <span className="sr-only">Search people on letsee by username</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people on letsee by username"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className="h-12 w-full rounded-control bg-raised pl-10 pr-3.5 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </label>

      {me && q.length >= 2 ? (
        <Results me={me} query={q} following={following} username={user?.username ?? null} />
      ) : me && rooms ? (
        <Shelves me={me} following={following} known={new Set(rooms.rooms.map((r) => r.person.id))} username={user?.username ?? null} />
      ) : me ? (
        <RowsSkeleton />
      ) : null}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-app px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <h1 className="mb-5 text-4xl text-ink-0 sm:text-5xl">People</h1>
      <PeopleNav current="find" />
      {children}
    </div>
  );
}

/* ── Typing: members by username ───────────────────────────────────────── */

function Results({ me, query, following, username }: { me: string; query: string; following: Set<string>; username: string | null }) {
  const [settled, setSettled] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setSettled(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: found, isLoading } = useSWR(["find-people", settled.toLowerCase(), me], () => searchUsers(settled, me), { keepPreviousData: true });
  const { data: loves } = useSWR(found?.length ? ["find-people-loves", me, found.map((p) => p.id).join(",")] : null, () => sharedLoves(me, found!), { revalidateOnFocus: false });
  const people: Candidate[] = (found ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    avatarUrl: p.avatarUrl,
    reason: loves?.get(p.id) ? `You both loved ${loves.get(p.id)}` : following.has(p.id) ? "You follow them" : null,
  }));

  if (!found && isLoading) return <RowsSkeleton />;
  return (
    <section aria-label="People found" className="mt-6 max-w-read">
      {people.length > 0 ? (
        <PeopleList me={me} people={people} following={following} />
      ) : (
        <div className="rounded-card bg-raised p-5 ring-1 ring-inset ring-line-strong">
          <p className="text-base text-ink-0">No one called &ldquo;{query}&rdquo; on letsee yet.</p>
          <p className="mt-1 text-sm text-ink-400">If they&apos;re a friend, send them your link — when they join, you&apos;ll find each other here.</p>
          <button
            type="button"
            onClick={() => void inviteSomeone(username)}
            className="mt-4 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
          >
            Send them your link
          </button>
        </div>
      )}
    </section>
  );
}

/* ── Before typing: shelves, each with its reason ──────────────────────── */

function Shelves({ me, following, known, username }: { me: string; following: Set<string>; known: Set<string>; username: string | null }) {
  const { data: taste } = useSWR(["find-taste", me], () => fetchMyNeighbours(12).catch(() => []), { revalidateOnFocus: false });
  const { data: viaPeople } = useSWR(["find-via-people", me], () => followedByYourPeople(me, new Set(), 12), { revalidateOnFocus: false });
  const { data: fresh } = useSWR(["find-new", me], () => newOnLetsee(me, new Set(), 12), { revalidateOnFocus: false });
  const { data: active } = useSWR(["find-active", me], () => recentlyActive(me, new Set(), 12), { revalidateOnFocus: false });

  // Each shelf skips anyone you follow and anyone a shelf above already showed.
  const shelves = useMemo(() => {
    const seen = new Set<string>([...following, me]);
    const take = (list: Candidate[], n: number) => {
      const out = list.filter((p) => !seen.has(p.id)).slice(0, n);
      out.forEach((p) => seen.add(p.id));
      return out;
    };
    const tasteRows: Candidate[] = (taste ?? []).map((m) => {
      const shared = m.sharedTitles.slice(0, 2).map((t) => t.name);
      return { id: m.userId, username: m.username, avatarUrl: m.avatarUrl, reason: shared.length ? `You've both seen ${shared.join(" and ")}` : null };
    });
    const activeRows: Candidate[] = (active ?? []).map((p) => ({
      id: p.id,
      username: p.username,
      avatarUrl: p.avatarUrl,
      reason: p.lastTitle ? `Watched ${p.lastTitle} · ${ago(p.lastAt)}` : `Logged something · ${ago(p.lastAt)}`,
    }));
    return [
      { key: "taste", title: "Your kind of taste", lead: "People who've seen and loved what you have.", people: take(tasteRows, 6) },
      { key: "via", title: "Followed by your people", lead: "Who the people you follow follow.", people: take(viaPeople ?? [], 6) },
      { key: "new", title: "New on letsee", lead: "Just arrived — easy to say hello to.", people: take(fresh ?? [], 6) },
      { key: "active", title: "Watching lately", lead: "What people here have logged in the last few days.", people: take(activeRows, 6) },
    ];
  }, [taste, viaPeople, fresh, active, following, me]);

  const loading = !taste || !viaPeople || !fresh || !active;
  const any = shelves.some((s) => s.people.length > 0);

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-x-16">
      {shelves.map((s) =>
        s.people.length > 0 ? (
          <section key={s.key} aria-labelledby={`find-${s.key}`} className="min-w-0">
            <h2 id={`find-${s.key}`} className="text-2xl text-ink-0">
              {s.title}
            </h2>
            <p className="mt-1 text-sm text-ink-500">{s.lead}</p>
            <div className="mt-3">
              <PeopleList me={me} people={s.people} following={following} />
            </div>
          </section>
        ) : null,
      )}
      {loading && !any && <RowsSkeleton />}
      {!loading && !any && (
        <p className="text-base text-ink-400">Nobody to suggest yet — search for a friend by username above, or send them your link.</p>
      )}
      <section aria-labelledby="find-invite" className="min-w-0 rounded-card bg-raised p-5 ring-1 ring-inset ring-line-strong lg:col-span-2 lg:max-w-read">
        <h2 id="find-invite" className="text-xl text-ink-0">
          Someone you watch with isn&apos;t here?
        </h2>
        <p className="mt-1 text-sm text-ink-400">Send them your link. When they join, they&apos;ll find you straight away.</p>
        <button
          type="button"
          onClick={() => void inviteSomeone(username)}
          className="mt-4 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
        >
          Send your link
        </button>
      </section>
    </div>
  );
}

/* ── A person ──────────────────────────────────────────────────────────── */

function PeopleList({ me, people, following }: { me: string; people: Candidate[]; following: Set<string> }) {
  const ids = people.map((p) => p.id);
  const { data: details } = useSWR(ids.length ? ["find-details", ids.join(",")] : null, () => detailsFor(ids), { revalidateOnFocus: false });
  return (
    <ul className="divide-y divide-line">
      {people.map((p) => (
        <PersonRow key={p.id} me={me} person={p} details={details?.get(p.id)} following={following.has(p.id)} />
      ))}
    </ul>
  );
}

function PersonRow({ me, person, details, following }: { me: string; person: Candidate; details?: Details; following: boolean }) {
  const profile = `/app/profile/${encodeURIComponent(person.username)}`;
  const line = person.reason ?? details?.tagline ?? null;
  return (
    <li className="flex items-start gap-3 py-3.5">
      <Link href={profile} className="shrink-0">
        <Avatar src={person.avatarUrl} name={person.username} size={44} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={profile} className="block truncate text-base font-medium text-ink-0 hover:text-accent">
          {person.username}
        </Link>
        {line && <p className="truncate text-sm text-ink-400">{line}</p>}
        {details && details.four.length > 0 && (
          <Link href={profile} aria-label={`${person.username}'s four: ${details.four.map((f) => f.name).join(", ")}`} className="mt-2 flex gap-1.5">
            {details.four.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.image} src={f.image} alt="" loading="lazy" decoding="async" className="aspect-2/3 w-9 rounded-sm bg-hover object-cover ring-1 ring-inset ring-line-strong" />
            ))}
          </Link>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <Link
          href={`/app/people/${encodeURIComponent(person.username)}`}
          aria-label={`Message ${person.username}`}
          className="flex size-9 items-center justify-center rounded-full text-ink-300 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
        >
          <MessageCircle className="size-4" aria-hidden />
        </Link>
        <FollowButton targetUserId={person.id} currentUserId={me} targetVisibility={details?.visibility ?? "public"} initialStatus={following ? "following" : "follow"} size="sm" />
      </div>
    </li>
  );
}

function RowsSkeleton() {
  return (
    <ul className="mt-6 max-w-read divide-y divide-line" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-3.5">
          <span className="size-11 shrink-0 animate-pulse rounded-full bg-active motion-reduce:animate-none" />
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-32 animate-pulse rounded bg-active motion-reduce:animate-none" />
            <span className="block h-3 w-48 animate-pulse rounded bg-active motion-reduce:animate-none" />
          </span>
        </li>
      ))}
    </ul>
  );
}
