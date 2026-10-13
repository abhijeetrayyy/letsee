"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { ArrowRight, MessageCircle, Search } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import FollowButton from "@components/profile/FollowButton";
import PeopleNav from "@components/rooms/PeopleNav";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList } from "@/lib/db/rooms";
import { fetchMyNeighbours } from "@/lib/db/taste";
import { recentlyActive, searchUsers, sharedLoves } from "@/lib/db/search";
import { detailsFor, everyoneNewest, followedByYourPeople, type Candidate, type Details } from "@/lib/db/discover";
import { inviteSomeone } from "@components/home/v2/parts";
import { ago } from "@components/rooms/time";

/**
 * Find people on letsee — not actors: Search's people are TMDB's cast and
 * crew, and "Find anyone" used to send you there.
 *
 * Typing searches members by username. Before that, everyone on letsee, in
 * the order you choose: newest first (the default — who just arrived), most
 * like you (the nightly taste neighbours, in words, never a percentage),
 * watching lately, or followed by your people. Twenty at a time, then Show
 * more. People you follow are there too, and say so; so does someone who
 * follows you. Every row says why in a few words, names a film you both
 * loved when there is one, shows the four films on their profile when it's
 * public, and has Follow and Message right there.
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
  const followers = useMemo(() => new Set(rooms?.followers ?? []), [rooms]);

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
      {/* The game: meet people by their four favourite films before you know who they are. */}
      <Link
        href="/app/people/find/four"
        className="group mb-6 flex max-w-read items-center gap-4 rounded-card bg-raised p-4 ring-1 ring-inset ring-line-strong transition-colors hover:bg-hover sm:p-5"
      >
        <span aria-hidden className="grid size-14 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-control">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i % 3 === 0 ? "bg-action" : "bg-active"} />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium uppercase tracking-wider text-accent">A game</span>
          <span className="block font-display text-xl text-ink-0">Blind four</span>
          <span className="block text-sm text-ink-400">A stranger&apos;s four favourite films. Your taste? Turn the card to meet them.</span>
        </span>
        <ArrowRight className="size-5 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>

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
        <Results me={me} query={q} following={following} followers={followers} username={user?.username ?? null} />
      ) : me && rooms ? (
        <Everyone me={me} following={following} followers={followers} username={user?.username ?? null} />
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

function Results({ me, query, following, followers, username }: { me: string; query: string; following: Set<string>; followers: Set<string>; username: string | null }) {
  const [settled, setSettled] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setSettled(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: found, isLoading } = useSWR(["find-people", settled.toLowerCase(), me], () => searchUsers(settled, me), { keepPreviousData: true });
  const people: Candidate[] = (found ?? []).map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatarUrl, reason: following.has(p.id) ? "You follow them" : null }));

  if (!found && isLoading) return <RowsSkeleton />;
  return (
    <section aria-label="People found" className="mt-6 max-w-read">
      {people.length > 0 ? (
        <PeopleList me={me} people={people} following={following} followers={followers} />
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

/* ── Before typing: everyone, in the order you choose ──────────────────── */

type Order = "new" | "like" | "active" | "via";

const ORDERS: { key: Order; label: string; lead: string }[] = [
  { key: "new", label: "Newest", lead: "Everyone on letsee, newest first." },
  { key: "like", label: "Most like you", lead: "People who've seen and loved what you have — worked out overnight." },
  { key: "active", label: "Watching lately", lead: "Who's logged something most recently." },
  { key: "via", label: "Followed by your people", lead: "Who the people you follow follow." },
];

const PAGE = 20;

function Everyone({ me, following, followers, username }: { me: string; following: Set<string>; followers: Set<string>; username: string | null }) {
  const [order, setOrder] = useState<Order>("new");
  // "Followed by your people" is offered only when there's someone in it (the same read it shows).
  const { data: via } = useSWR(following.size ? ["find-ranked", "via", me] : null, () => rankedPeople(me, "via"), { revalidateOnFocus: false });
  const orders = ORDERS.filter((o) => o.key !== "via" || (via?.length ?? 0) > 0);
  const lead = ORDERS.find((o) => o.key === order)!.lead;

  return (
    <div className="mt-8 grid max-w-read gap-10">
      <section aria-labelledby="find-everyone" className="min-w-0">
        <h2 id="find-everyone" className="text-2xl text-ink-0">
          Everyone on letsee
        </h2>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Order">
          {orders.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={order === o.key}
              onClick={() => setOrder(o.key)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${order === o.key ? "bg-ink-0 text-page" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-500">{lead}</p>
        <div className="mt-2">
          {order === "new" ? (
            <Newest me={me} following={following} followers={followers} />
          ) : (
            // Remounted per order, so Show more starts again at twenty.
            <Ranked key={order} me={me} order={order} following={following} followers={followers} />
          )}
        </div>
      </section>

      <section aria-labelledby="find-invite" className="min-w-0 rounded-card bg-raised p-5 ring-1 ring-inset ring-line-strong">
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

/** Newest first, a page at a time from the database: it grows with letsee. */
function Newest({ me, following, followers }: { me: string; following: Set<string>; followers: Set<string> }) {
  const { data, size, setSize, isValidating } = useSWRInfinite(
    (index, previous: { more: boolean } | null) => (index > 0 && !previous?.more ? null : ["find-everyone", me, index]),
    ([, who, index]) => everyoneNewest(who as string, (index as number) * PAGE, PAGE),
    { revalidateOnFocus: false, revalidateFirstPage: false },
  );
  if (!data) return <RowsSkeleton />;
  const people = data.flatMap((p) => p.people);
  const more = !!data.at(-1)?.more;
  if (!people.length) return <p className="py-4 text-base text-ink-400">Nobody else here yet — send someone your link.</p>;
  return (
    <>
      <PeopleList me={me} people={people} following={following} followers={followers} />
      {more && <ShowMore busy={isValidating && size > data.length} onClick={() => void setSize(size + 1)} />}
    </>
  );
}

/** The other orders: a ranked list read once, shown twenty at a time. */
function Ranked({ me, order, following, followers }: { me: string; order: Exclude<Order, "new">; following: Set<string>; followers: Set<string> }) {
  const [shown, setShown] = useState(PAGE);
  const { data } = useSWR(["find-ranked", order, me], () => rankedPeople(me, order), { revalidateOnFocus: false });
  if (!data) return <RowsSkeleton />;
  if (!data.length) {
    return (
      <p className="py-4 text-base text-ink-400">
        {order === "like"
          ? "Nobody to match yet. Matches are worked out overnight from what everyone marks — mark a few more films, and look again tomorrow."
          : order === "active"
            ? "Nobody's logged anything lately."
            : "Nobody yet — the people you follow don't follow anyone you don't."}
      </p>
    );
  }
  return (
    <>
      {/* "Most like you" already says what you share; the others look for a film you both loved. */}
      <PeopleList me={me} people={data.slice(0, shown)} following={following} followers={followers} loves={order !== "like"} />
      {data.length > shown && <ShowMore busy={false} onClick={() => setShown((n) => n + PAGE)} />}
    </>
  );
}

async function rankedPeople(me: string, order: Exclude<Order, "new">): Promise<Candidate[]> {
  if (order === "like") {
    const matches = await fetchMyNeighbours(60).catch(() => []);
    return matches.map((m) => {
      const shared = m.sharedTitles.slice(0, 2).map((t) => t.name);
      return { id: m.userId, username: m.username, avatarUrl: m.avatarUrl, reason: m.icebreaker || (shared.length ? `You've both seen ${shared.join(" and ")}` : null) };
    });
  }
  if (order === "active") {
    const active = await recentlyActive(me, new Set(), 60);
    return active.map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatarUrl, reason: p.lastTitle ? `Watched ${p.lastTitle} · ${ago(p.lastAt)}` : `Logged something · ${ago(p.lastAt)}` }));
  }
  return followedByYourPeople(me, new Set(), 60);
}

function ShowMore({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="mt-3 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover disabled:opacity-60"
    >
      {busy ? "Loading…" : "Show more"}
    </button>
  );
}

/* ── A person ──────────────────────────────────────────────────────────── */

function PeopleList({ me, people, following, followers, loves = true }: { me: string; people: Candidate[]; following: Set<string>; followers: Set<string>; loves?: boolean }) {
  const ids = people.map((p) => p.id);
  const { data: details } = useSWR(ids.length ? ["find-details", ids.join(",")] : null, () => detailsFor(ids), { revalidateOnFocus: false });
  // A film you both loved, for whoever shows their ratings: two reads for the whole list.
  const { data: loved } = useSWR(loves && details ? ["find-loves", me, ids.join(",")] : null, () =>
    sharedLoves(
      me,
      people.map((p) => ({ id: p.id, username: p.username, avatarUrl: p.avatarUrl, showsRatings: details!.get(p.id)?.showsRatings ?? false })),
    ),
    { revalidateOnFocus: false },
  );
  return (
    <ul className="divide-y divide-line">
      {people.map((p) => (
        <PersonRow key={p.id} me={me} person={p} details={details?.get(p.id)} loved={loved?.get(p.id) ?? null} following={following.has(p.id)} followsYou={followers.has(p.id)} />
      ))}
    </ul>
  );
}

function PersonRow({ me, person, details, loved, following, followsYou }: { me: string; person: Candidate; details?: Details; loved: string | null; following: boolean; followsYou: boolean }) {
  const profile = `/app/profile/${encodeURIComponent(person.username)}`;
  // "Follows you" first: the one thing here that's about the two of you.
  const line = [followsYou ? "Follows you" : null, person.reason ?? details?.tagline ?? null].filter(Boolean).join(" · ") || null;
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
        {loved && (
          <p className="truncate text-sm text-ink-400">
            You both loved <em className="font-display text-base not-italic text-ink-0">{loved}</em>
          </p>
        )}
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
